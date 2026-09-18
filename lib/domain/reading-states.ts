import type { ReadingStatus, UserRole } from "./types";

export function floorUserCanMutate(status: ReadingStatus): boolean {
  return status !== "approved";
}

export function canTransitionReadingStatus(input: {
  from: ReadingStatus;
  to: ReadingStatus;
  role: UserRole;
}): boolean {
  const { from, to, role } = input;

  if (from === to) {
    return to !== "approved";
  }

  if (role === "floor_user") {
    return from === "rejected" && to === "pending";
  }

  if (to === "approved") {
    return from === "pending" || from === "rejected";
  }

  if (to === "rejected") {
    return from === "pending" || from === "approved";
  }

  if (to === "pending") {
    return from === "rejected" || from === "approved";
  }

  return false;
}

export function statusAfterFloorResubmit(): ReadingStatus {
  return "pending";
}

export function isApproved(status: ReadingStatus): boolean {
  return status === "approved";
}
