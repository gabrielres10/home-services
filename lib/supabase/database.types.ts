export const STORAGE_BUCKETS = {
  bills: "bills",
  photos: "reading-photos",
} as const;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type UserRole = "admin" | "floor_user";
type PeriodStatus = "open" | "ready" | "closed";
type ReadingStatus = "pending" | "approved" | "rejected";
type ConsumptionSource = "metered" | "copied";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          username: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          username: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          username?: string;
          role?: UserRole;
        };
        Relationships: [];
      };
      floors: {
        Row: {
          id: string;
          code: string;
          name: string;
          occupant_name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          occupant_name: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          occupant_name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          code: string;
          name: string;
          unit: string;
          consumption_source: ConsumptionSource;
          copied_from_service_id: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          unit: string;
          consumption_source: ConsumptionSource;
          copied_from_service_id?: string | null;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          unit?: string;
          consumption_source?: ConsumptionSource;
          copied_from_service_id?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      floor_service_meters: {
        Row: {
          floor_id: string;
          service_id: string;
        };
        Insert: {
          floor_id: string;
          service_id: string;
        };
        Update: {
          floor_id?: string;
          service_id?: string;
        };
        Relationships: [];
      };
      floor_memberships: {
        Row: {
          user_id: string;
          floor_id: string;
        };
        Insert: {
          user_id: string;
          floor_id: string;
        };
        Update: {
          floor_id?: string;
        };
        Relationships: [];
      };
      billing_periods: {
        Row: {
          id: string;
          label: string;
          starts_on: string;
          ends_on: string;
          status: PeriodStatus;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          starts_on: string;
          ends_on: string;
          status?: PeriodStatus;
          created_by: string;
          created_at?: string;
        };
        Update: {
          label?: string;
          starts_on?: string;
          ends_on?: string;
          status?: PeriodStatus;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          id: string;
          period_id: string;
          pdf_storage_path: string | null;
          uploaded_by: string | null;
          uploaded_at: string | null;
          notes: string | null;
          other_services_ap_subtotal: number | null;
        };
        Insert: {
          id?: string;
          period_id: string;
          pdf_storage_path?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string | null;
          notes?: string | null;
          other_services_ap_subtotal?: number | null;
        };
        Update: {
          pdf_storage_path?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string | null;
          notes?: string | null;
          other_services_ap_subtotal?: number | null;
        };
        Relationships: [];
      };
      bill_service_totals: {
        Row: {
          bill_id: string;
          service_id: string;
          total_consumption: number;
        };
        Insert: {
          bill_id: string;
          service_id: string;
          total_consumption: number;
        };
        Update: {
          total_consumption?: number;
        };
        Relationships: [];
      };
      bill_service_charges: {
        Row: {
          bill_id: string;
          service_id: string;
          charge_code: string;
          amount: number;
        };
        Insert: {
          bill_id: string;
          service_id: string;
          charge_code: string;
          amount: number;
        };
        Update: {
          amount?: number;
        };
        Relationships: [];
      };
      meter_readings: {
        Row: {
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
        Insert: {
          id?: string;
          period_id: string;
          floor_id: string;
          service_id: string;
          submitted_value: number;
          submitted_by: string;
          submitted_at?: string;
          value: number;
          reading_date: string;
          status?: ReadingStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          corrected_by?: string | null;
          corrected_at?: string | null;
          current_photo_id?: string | null;
        };
        Update: {
          submitted_value?: number;
          submitted_by?: string;
          submitted_at?: string;
          value?: number;
          reading_date?: string;
          status?: ReadingStatus;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          corrected_by?: string | null;
          corrected_at?: string | null;
          current_photo_id?: string | null;
        };
        Relationships: [];
      };
      reading_photos: {
        Row: {
          id: string;
          reading_id: string;
          storage_path: string;
          uploaded_by: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          reading_id: string;
          storage_path: string;
          uploaded_by: string;
          uploaded_at?: string;
        };
        Update: {
          storage_path?: string;
          current?: boolean;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          occurred_at: string;
          entity_type: string;
          entity_id: string;
          action: string;
          from_data: Json | null;
          to_data: Json | null;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          occurred_at?: string;
          entity_type: string;
          entity_id: string;
          action: string;
          from_data?: Json | null;
          to_data?: Json | null;
        };
        Update: {
          action?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      user_floor_id: { Args: Record<string, never>; Returns: string };
      auth_email_for_username: { Args: { p_username: string }; Returns: string | null };
    };
    Enums: {
      user_role: UserRole;
      period_status: PeriodStatus;
      reading_status: ReadingStatus;
      consumption_source: ConsumptionSource;
    };
    CompositeTypes: Record<string, never>;
  };
};
