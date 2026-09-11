"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import type { Requisition, Vehicle, Driver } from "@/lib/types";
import { CheckCircle2, ChevronRight } from "lucide-react";

export default function AllocatePage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [options, setOptions] = useState<{ vehicles: Vehicle[]; drivers: Driver[] } | null>(null);
  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [driverId, setDriverId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justAllocated, setJustAllocated] = useState<Requisition | null>(null);

  const loadPending = useCallback(async () => {
    const { requisitions } = await api.listRequisitions();
    setRequisitions(requisitions.filter((r) => r.status === "Pending Allocation"));
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function selectRequisition(r: Requisition) {
    setSelected(r);
    setVehicleId("");
    setDriverId("");
    setError("");
    setJustAllocated(null);
    // The system computes availability server-side — the admin never manually checks.
    const result = await api.availability(r.start_date, r.end_date);
    setOptions(result);
  }

  async function handleAllocate() {
    if (!selected || !vehicleId || !driverId) return;
    setError("");
    setSubmitting(true);
    try {
      const { requisition } = await api.allocate(selected.id, Number(vehicleId), Number(driverId));
      setJustAllocated(requisition);
      setSelected(null);
      setOptions(null);
      loadPending();
    } catch (err: any) {
      setError(err.message || "Could not allocate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-7">
        <h1 className="font-head font-semibold text-xl text-ink">Allocate Vehicle</h1>
        <p className="text-sm text-muted mt-1">
          Pick a pending request — the system checks the database for real conflicts and only shows you
          vehicles and drivers that are actually free for those dates.
        </p>
      </div>

      {justAllocated && (
        <div className="mb-6 rounded-xl border border-teal/40 bg-teal/10 px-4 py-3.5 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-teal mt-0.5 shrink-0" />
          <div className="text-sm text-ink">
            Allocated for <span className="font-mono text-teal">S.no {justAllocated.sno}</span>. It now shows as
            Scheduled on the dashboard.
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Pending Allocation</h2>
          <div className="space-y-2">
            {requisitions.map((r) => (
              <button
                key={r.id}
                onClick={() => selectRequisition(r)}
                className={`w-full text-left rounded-xl border bg-surface px-4 py-3.5 flex items-center justify-between transition-colors ${
                  selected?.id === r.id ? "border-amber/60 bg-surface2" : "border-border hover:bg-surface2/60"
                }`}
              >
                <div>
                  <div className="text-sm text-ink">
                    <span className="font-mono text-amber mr-2">#{r.sno}</span>
                    {r.requester} · {r.department}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {r.start_date} → {r.end_date} · {r.origin} → {r.destination}
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted shrink-0" />
              </button>
            ))}
            {requisitions.length === 0 && (
              <p className="text-sm text-muted">No pending requisitions — all caught up.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
            {selected ? `Available for #${selected.sno}` : "Select a request"}
          </h2>

          {!selected && (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              Choose a pending requisition on the left to see what's actually free for its dates.
            </div>
          )}

          {selected && options && (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-5">
              <div>
                <label className="text-xs text-muted mb-1.5 block">Vehicle</label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-lg bg-surface2 border border-border px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber/60"
                >
                  <option value="">Select vehicle…</option>
                  {options.vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.reg_no} — {v.model}
                    </option>
                  ))}
                </select>
                {options.vehicles.length === 0 && (
                  <p className="text-xs text-red mt-1.5">No vehicles free for these dates.</p>
                )}
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block">Driver</label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-lg bg-surface2 border border-border px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber/60"
                >
                  <option value="">Select driver…</option>
                  {options.drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {options.drivers.length === 0 && (
                  <p className="text-xs text-red mt-1.5">No drivers free for these dates.</p>
                )}
              </div>

              {error && <p className="text-xs text-red">{error}</p>}

              <button
                onClick={handleAllocate}
                disabled={!vehicleId || !driverId || submitting}
                className="w-full rounded-lg bg-amber text-bg font-medium text-sm py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitting ? "Allocating…" : "Confirm allocation"}
              </button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
