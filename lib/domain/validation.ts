import { consumptionFromApprovedReadings, unmeteredFloorConsumption } from "./consumption";
import type { PeriodStatus, ValidationIssue } from "./types";

const VALUE_PATTERN = /^\d+([.,]\d+)?$/;

export function parseReadingValue(
  raw: string,
): { ok: true; value: number } | { ok: false; issue: ValidationIssue } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return {
      ok: false,
      issue: {
        code: "reading.empty",
        severity: "error",
        message: "La lectura está vacía.",
      },
    };
  }

  if (!VALUE_PATTERN.test(trimmed)) {
    return {
      ok: false,
      issue: {
        code: "reading.not_numeric",
        severity: "error",
        message: "La lectura debe ser un número mayor o igual a cero.",
      },
    };
  }

  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      issue: {
        code: "reading.not_numeric",
        severity: "error",
        message: "La lectura debe ser un número mayor o igual a cero.",
      },
    };
  }

  return { ok: true, value };
}

export function currentLessThanPreviousIssue(
  current: number,
  previous: number,
): ValidationIssue | null {
  if (current < previous) {
    return {
      code: "reading.current_less_than_previous",
      severity: "warning",
      message: `La lectura actual (${current}) es menor que la anterior (${previous}).`,
    };
  }
  return null;
}

export type ReadingDraftInput = {
  rawValue: string;
  hasPhoto: boolean;
  previousApproved: number | null;
  hasEarlierPeriod: boolean;
  periodStatus: PeriodStatus;
  hasMeter: boolean;
  serviceAllowed: boolean;
  alreadyHasApprovedReading: boolean;
};

export function validateReadingDraft(input: ReadingDraftInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!input.hasMeter) {
    issues.push({
      code: "reading.no_meter",
      severity: "error",
      message: "Este piso no tiene contador para el servicio seleccionado.",
    });
  }

  if (!input.serviceAllowed) {
    issues.push({
      code: "reading.wrong_service",
      severity: "error",
      message: "El servicio no corresponde a un contador de este piso.",
    });
  }

  if (input.periodStatus !== "open") {
    issues.push({
      code: "reading.period_not_open",
      severity: "error",
      message: "El período no admite envío de lecturas.",
    });
  }

  if (input.alreadyHasApprovedReading) {
    issues.push({
      code: "reading.already_approved",
      severity: "error",
      message: "Una lectura aprobada no puede modificarse desde el piso.",
    });
  }

  const parsed = parseReadingValue(input.rawValue);
  if (!parsed.ok) {
    issues.push(parsed.issue);
  } else if (parsed.value < 0) {
    issues.push({
      code: "reading.negative",
      severity: "error",
      message: "La lectura no puede ser negativa.",
    });
  } else if (input.previousApproved !== null) {
    const warning = currentLessThanPreviousIssue(parsed.value, input.previousApproved);
    if (warning) {
      issues.push(warning);
    }
  }

  if (!input.hasPhoto) {
    issues.push({
      code: "reading.photo_missing",
      severity: "error",
      message: "Debe adjuntarse una fotografía del contador.",
    });
  }

  if (input.previousApproved === null && input.hasEarlierPeriod) {
    issues.push({
      code: "reading.missing_previous",
      severity: "warning",
      message:
        "No hay una lectura anterior aprobada. El consumo no se puede calcular todavía.",
    });
  }

  return issues;
}

export function validateBillTotals(input: {
  energy: number | null;
  water: number | null;
  sewer: number | null;
  hasPdf: boolean;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!input.hasPdf) {
    issues.push({
      code: "bill.pdf_missing",
      severity: "error",
      message: "Falta el PDF del recibo.",
    });
  }

  if (input.energy === null) {
    issues.push({
      code: "bill.energy_missing",
      severity: "error",
      message: "Falta el consumo total de energía.",
    });
  }

  if (input.water === null) {
    issues.push({
      code: "bill.water_missing",
      severity: "error",
      message: "Falta el consumo total de agua.",
    });
  }

  if (input.sewer === null) {
    issues.push({
      code: "bill.sewer_missing",
      severity: "error",
      message: "Falta el consumo total de alcantarillado.",
    });
  }

  if (
    input.water !== null &&
    input.sewer !== null &&
    input.water !== input.sewer
  ) {
    issues.push({
      code: "bill.sewer_differs_from_water",
      severity: "warning",
      message:
        "El total de alcantarillado del recibo no coincide con el de agua. El consumo por piso de alcantarillado se copiará del agua.",
    });
  }

  return issues;
}

export function unmeteredConsumptionIssue(
  floorName: string,
  serviceName: string,
  result: ReturnType<typeof unmeteredFloorConsumption>,
): ValidationIssue | null {
  if (result.status === "negative") {
    return {
      code: "consumption.unmetered_negative",
      severity: "error",
      message: `${floorName} / ${serviceName}: el consumo por diferencia es negativo (${result.consumption}). La liquidación no es válida.`,
    };
  }
  return null;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

export function missingPreviousBlocksConsumption(
  currentApproved: number | null,
  previousApproved: number | null,
): boolean {
  return (
    consumptionFromApprovedReadings(currentApproved, previousApproved).status !==
    "ok"
  );
}
