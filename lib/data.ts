import { supabase } from "./supabase";
import type { Vehicle, Driver, Requisition, Role } from "./types";

export async function logActivity(
  requisitionId: number | null,
  actorRole: Role | "system",
  action: string,
  details?: unknown
) {
  const { error } = await supabase.from("activity_log").insert({
    requisition_id: requisitionId,
    actor_role: actorRole,
    action,
    details: details ?? null,
  });
  if (error) console.error("logActivity failed:", error.message);
}

// ---------------- vehicles ----------------
export async function listVehicles(activeOnly = true): Promise<Vehicle[]> {
  let query = supabase.from("vehicles").select("*").order("reg_no");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Vehicle[];
}

export async function addVehicle(reg_no: string, model: string): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .insert({ reg_no, model })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity(null, "admin", "vehicle_added", { reg_no, model });
  return data as Vehicle;
}

export async function removeVehicle(id: number): Promise<{ ok: boolean; reason?: string }> {
  const { data: inUse, error: checkErr } = await supabase
    .from("requisitions")
    .select("id")
    .eq("vehicle_id", id)
    .in("status", ["Scheduled", "Active"])
    .limit(1);
  if (checkErr) throw new Error(checkErr.message);
  if (inUse && inUse.length > 0) {
    return { ok: false, reason: "Vehicle has a scheduled or active trip" };
  }
  const { error } = await supabase.from("vehicles").update({ active: false }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(null, "admin", "vehicle_removed", { id });
  return { ok: true };
}

// ---------------- drivers ----------------
export async function listDrivers(activeOnly = true): Promise<Driver[]> {
  let query = supabase.from("drivers").select("*").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Driver[];
}

export async function addDriver(name: string, phone?: string): Promise<Driver> {
  const { data, error } = await supabase
    .from("drivers")
    .insert({ name, phone: phone ?? null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity(null, "admin", "driver_added", { name });
  return data as Driver;
}

export async function removeDriver(id: number): Promise<{ ok: boolean; reason?: string }> {
  const { data: inUse, error: checkErr } = await supabase
    .from("requisitions")
    .select("id")
    .eq("driver_id", id)
    .in("status", ["Scheduled", "Active"])
    .limit(1);
  if (checkErr) throw new Error(checkErr.message);
  if (inUse && inUse.length > 0) {
    return { ok: false, reason: "Driver has a scheduled or active trip" };
  }
  const { error } = await supabase.from("drivers").update({ active: false }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(null, "admin", "driver_removed", { id });
  return { ok: true };
}

// ---------------- requisitions ----------------
export async function listRequisitions(): Promise<Requisition[]> {
  const { data, error } = await supabase.from("requisitions").select("*").order("sno");
  if (error) throw new Error(error.message);
  return data as Requisition[];
}

export async function getRequisition(id: number): Promise<Requisition | undefined> {
  const { data, error } = await supabase.from("requisitions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Requisition) ?? undefined;
}

export interface NewRequisitionInput {
  requester: string;
  department: string;
  start_date: string;
  end_date: string;
  origin: string;
  destination: string;
  purpose?: string;
}

export async function createRequisition(input: NewRequisitionInput): Promise<Requisition> {
  // sno is an identity column, so Postgres assigns it automatically — we just insert.
  const { data, error } = await supabase
    .from("requisitions")
    .insert({ ...input, purpose: input.purpose ?? null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const req = data as Requisition;
  await logActivity(req.id, "user", "submitted", { sno: req.sno });
  return req;
}

/** The System's automatic availability check — mirrors the flowchart's "Checks availability" step. */
export async function availableFor(
  start: string,
  end: string
): Promise<{ vehicles: Vehicle[]; drivers: Driver[] }> {
  // Any requisition whose date range overlaps [start, end] and has status Scheduled/Active holds its vehicle/driver busy.
  const { data: overlapping, error } = await supabase
    .from("requisitions")
    .select("vehicle_id, driver_id")
    .lte("start_date", end)
    .gte("end_date", start)
    .in("status", ["Scheduled", "Active"]);
  if (error) throw new Error(error.message);

  const busyVehicleIds = new Set((overlapping ?? []).map((r) => r.vehicle_id).filter(Boolean));
  const busyDriverIds = new Set((overlapping ?? []).map((r) => r.driver_id).filter(Boolean));

  const [vehicles, drivers] = await Promise.all([listVehicles(), listDrivers()]);
  return {
    vehicles: vehicles.filter((v) => !busyVehicleIds.has(v.id)),
    drivers: drivers.filter((d) => !busyDriverIds.has(d.id)),
  };
}

export async function allocate(
  reqId: number,
  vehicleId: number,
  driverId: number
): Promise<{ ok: boolean; reason?: string; requisition?: Requisition }> {
  const req = await getRequisition(reqId);
  if (!req) return { ok: false, reason: "Requisition not found" };
  if (req.status !== "Pending Allocation") return { ok: false, reason: "Already allocated" };

  // Final server-side conflict check — never trust the client's earlier read.
  const { vehicles, drivers } = await availableFor(req.start_date, req.end_date);
  if (!vehicles.some((v) => v.id === vehicleId)) {
    return { ok: false, reason: "Vehicle no longer available for these dates" };
  }
  if (!drivers.some((d) => d.id === driverId)) {
    return { ok: false, reason: "Driver no longer available for these dates" };
  }

  const { data, error } = await supabase
    .from("requisitions")
    .update({ vehicle_id: vehicleId, driver_id: driverId, status: "Scheduled", allocated_at: new Date().toISOString() })
    .eq("id", reqId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await logActivity(reqId, "admin", "allocated", { vehicleId, driverId });
  return { ok: true, requisition: data as Requisition };
}
