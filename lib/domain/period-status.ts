import type { PeriodStatus, ValidationIssue } from "./types";

export type PeriodReadingCounts = {
  expectedCount: number;
  submittedCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  missingCount: number;
};

export function countPeriodReadings(input: {
  expectedCount: number;
  submittedCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
}): PeriodReadingCounts {
  return {
    ...input,
    missingCount: Math.max(input.expectedCount - input.submittedCount, 0),
  };
}

export function canSubmitInPeriod(status: PeriodStatus): boolean {
  return status === "open";
}

export function periodStatusLabel(status: PeriodStatus): string {
  switch (status) {
    case "open":
      return "Pendiente de completar";
    case "ready":
      return "Listo para liquidar";
    case "closed":
      return "Cerrado";
  }
}

export type ReadinessInput = {
  expectedCount: number;
  approvedCount: number;
  billComplete: boolean;
  allMeteredConsumptionsCalculable: boolean;
  hasNegativeUnmetered: boolean;
  isOpeningPeriod?: boolean;
};

export type ReadinessResult = {
  ready: boolean;
  blockers: ValidationIssue[];
};

export function evaluatePeriodReadiness(input: ReadinessInput): ReadinessResult {
  const blockers: ValidationIssue[] = [];
  const isOpeningPeriod = Boolean(input.isOpeningPeriod);

  if (!isOpeningPeriod && !input.billComplete) {
    blockers.push({
      code: "period.bill_incomplete",
      severity: "error",
      message: "El recibo aún no tiene PDF, consumos totales e importes de todos los servicios.",
    });
  }

  if (input.approvedCount < input.expectedCount) {
    blockers.push({
      code: "period.readings_incomplete",
      severity: "error",
      message: `Faltan lecturas aprobadas (${input.approvedCount}/${input.expectedCount}).`,
    });
  }

  if (!isOpeningPeriod && !input.allMeteredConsumptionsCalculable) {
    blockers.push({
      code: "period.consumption_not_calculable",
      severity: "error",
      message:
        "Hay lecturas aprobadas sin una lectura anterior aprobada. El consumo no es liquidable.",
    });
  }

  if (!isOpeningPeriod && input.hasNegativeUnmetered) {
    blockers.push({
      code: "period.negative_unmetered",
      severity: "error",
      message:
        "El consumo del piso sin contador es negativo. La liquidación no es válida.",
    });
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

export function canMarkPeriodReady(
  current: PeriodStatus,
  readiness: ReadinessResult,
): boolean {
  return current === "open" && readiness.ready;
}
