import type { HistoricalReading, ReadingStatus } from "./types";

export function readingDifference(current: number, previous: number): number {
  return current - previous;
}

export type MeteredConsumption =
  | { status: "ok"; consumption: number }
  | { status: "missing_current" }
  | { status: "missing_previous" };

export function consumptionFromApprovedReadings(
  currentApproved: number | null,
  previousApproved: number | null,
): MeteredConsumption {
  if (currentApproved === null) {
    return { status: "missing_current" };
  }
  if (previousApproved === null) {
    return { status: "missing_previous" };
  }
  return {
    status: "ok",
    consumption: readingDifference(currentApproved, previousApproved),
  };
}

export type DifferenceConsumption =
  | { status: "ok"; consumption: number }
  | { status: "negative"; consumption: number }
  | { status: "incomplete" };

export function unmeteredFloorConsumption(
  total: number | null,
  meteredConsumptions: Array<number | null>,
): DifferenceConsumption {
  if (total === null || meteredConsumptions.some((value) => value === null)) {
    return { status: "incomplete" };
  }

  const meteredTotal = meteredConsumptions.reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const consumption = total - meteredTotal;

  if (consumption < 0) {
    return { status: "negative", consumption };
  }

  return { status: "ok", consumption };
}

export function findPreviousApprovedValue(
  currentPeriodStartsOn: string,
  history: HistoricalReading[],
): number | null {
  const previous = history
    .filter(
      (item) =>
        item.status === "approved" && item.periodStartsOn < currentPeriodStartsOn,
    )
    .sort((a, b) => {
      if (a.periodStartsOn !== b.periodStartsOn) {
        return a.periodStartsOn < b.periodStartsOn ? 1 : -1;
      }
      return a.periodEndsOn < b.periodEndsOn ? 1 : -1;
    });

  const latest = previous[0];
  return latest === undefined ? null : latest.value;
}

export function approvedValueOrNull(
  status: ReadingStatus,
  value: number,
): number | null {
  return status === "approved" ? value : null;
}

export function copyFromSourceConsumption(
  source: MeteredConsumption | DifferenceConsumption,
): MeteredConsumption | DifferenceConsumption {
  return source;
}
