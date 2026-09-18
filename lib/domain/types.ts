export const USER_ROLES = ["admin", "floor_user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PERIOD_STATUSES = ["open", "ready", "closed"] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const READING_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export const CONSUMPTION_SOURCES = ["metered", "copied"] as const;
export type ConsumptionSource = (typeof CONSUMPTION_SOURCES)[number];

export const SERVICE_CODES = ["energia", "agua", "alcantarillado"] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];

export const FLOOR_CODES = ["piso-1", "piso-2", "piso-3"] as const;
export type FloorCode = (typeof FLOOR_CODES)[number];

export type IssueSeverity = "error" | "warning";

export type ValidationIssue = {
  code: string;
  severity: IssueSeverity;
  message: string;
};

export type HistoricalReading = {
  periodStartsOn: string;
  periodEndsOn: string;
  status: ReadingStatus;
  value: number;
};

export type MeterSlot = {
  floorId: string;
  floorCode: FloorCode | string;
  floorName: string;
  serviceId: string;
  serviceCode: ServiceCode | string;
  serviceName: string;
  unit: string;
};
