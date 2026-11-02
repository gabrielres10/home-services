import type {
  ConsumptionSource,
  PeriodStatus,
  ReadingStatus,
  UserRole,
} from "@/lib/domain/types";

// Filas tal como las devuelve pg (ver los parsers de lib/db/pool.ts):
// date → "YYYY-MM-DD", timestamptz → ISO, numeric → number.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRow = {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  password_hash: string;
  created_at: string;
};

export type FloorRow = {
  id: string;
  code: string;
  name: string;
  occupant_name: string;
  sort_order: number;
};

export type ServiceRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  consumption_source: ConsumptionSource;
  copied_from_service_id: string | null;
  sort_order: number;
};

export type FloorServiceMeterRow = {
  floor_id: string;
  service_id: string;
};

export type BillingPeriodRow = {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  status: PeriodStatus;
  created_by: string;
  created_at: string;
};

export type BillRow = {
  id: string;
  period_id: string;
  pdf_storage_path: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  notes: string | null;
  other_services_ap_subtotal: number | null;
};

export type BillServiceTotalRow = {
  bill_id: string;
  service_id: string;
  total_consumption: number;
};

export type BillServiceChargeRow = {
  bill_id: string;
  service_id: string;
  charge_code: string;
  amount: number;
};

export type MeterReadingRow = {
  id: string;
  period_id: string;
  floor_id: string;
  service_id: string;
  submitted_value: number;
  submitted_by: string;
  submitted_at: string;
  value: number;
  reading_date: string;
  status: ReadingStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  corrected_by: string | null;
  corrected_at: string | null;
  current_photo_id: string | null;
};

export type ReadingPhotoRow = {
  id: string;
  reading_id: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  occurred_at: string;
  entity_type: string;
  entity_id: string;
  action: string;
  from_data: Json | null;
  to_data: Json | null;
};
