import type { UserRole } from "./types";

export function canAccessAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function canManagePeriods(role: UserRole): boolean {
  return role === "admin";
}

export function canDeletePeriod(role: UserRole): boolean {
  return role === "admin";
}

export function canViewBill(role: UserRole): boolean {
  return role === "admin";
}

export function canReviewReadings(role: UserRole): boolean {
  return role === "admin";
}

export function canViewReading(input: {
  role: UserRole;
  actorFloorId: string | null;
  readingFloorId: string;
}): boolean {
  if (input.role === "admin") {
    return true;
  }
  return input.actorFloorId === input.readingFloorId;
}

export function canViewPhoto(input: {
  role: UserRole;
  actorFloorId: string | null;
  readingFloorId: string;
}): boolean {
  return canViewReading(input);
}

export function canSubmitReading(input: {
  role: UserRole;
  actorFloorId: string | null;
  readingFloorId: string;
  periodOpen: boolean;
  readingStatus: "pending" | "approved" | "rejected" | null;
}): boolean {
  if (!input.periodOpen) {
    return false;
  }
  if (input.role === "admin") {
    return true;
  }
  if (input.actorFloorId !== input.readingFloorId) {
    return false;
  }
  return input.readingStatus !== "approved";
}

export function canCorrectReading(role: UserRole): boolean {
  return role === "admin";
}
