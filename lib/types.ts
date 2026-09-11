export type Role = "user" | "admin";

export interface Vehicle {
  id: number;
  reg_no: string;
  model: string;
  active: boolean;
}

export interface Driver {
  id: number;
  name: string;
  phone: string | null;
  active: boolean;
}

export type RequisitionStatus = "Pending Allocation" | "Scheduled" | "Active" | "Completed";

export interface Requisition {
  id: number;
  sno: number;
  requester: string;
  department: string;
  start_date: string;
  end_date: string;
  origin: string;
  destination: string;
  purpose: string | null;
  vehicle_id: number | null;
  driver_id: number | null;
  status: RequisitionStatus;
  created_at: string;
  allocated_at: string | null;
}

export interface Session {
  name: string;
  role: Role;
}
