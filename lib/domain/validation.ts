import { consumptionFromApprovedReadings, unmeteredFloorConsumption } from "./consumption";
import {
  BILL_CHARGE_CATALOG,
  type BillChargeValueMap,
  isServiceCode,
} from "./bill-charges";
import { explainNumericReject, parseNumericRaw } from "./numeric";
import type { PeriodStatus, ServiceCode, ValidationIssue } from "./types";

function parseStrictNumber(
  raw: string,
  empty: { code: string; message: string },
  invalidCode: string,
): { ok: true; value: number } | { ok: false; issue: ValidationIssue } {
  if (raw === "") {
    return {
      ok: false,
      issue: {
        code: empty.code,
        severity: "error",
        message: empty.message,
      },
    };
  }

  const value = parseNumericRaw(raw);
  if (value === null) {
    return {
      ok: false,
      issue: {
        code: invalidCode,
        severity: "error",
        message: explainNumericReject(raw),
      },
    };
  }

  return { ok: true, value };
}

export function parseReadingValue(
  raw: string,
): { ok: true; value: number } | { ok: false; issue: ValidationIssue } {
  return parseStrictNumber(
    raw,
    { code: "reading.empty", message: "La lectura está vacía." },
    "reading.not_numeric",
  );
}

export function parseMoneyAmount(
  raw: string,
): { ok: true; value: number } | { ok: false; issue: ValidationIssue } {
  return parseStrictNumber(
    raw,
    { code: "bill.charge_empty", message: "El importe está vacío." },
    "bill.charge_not_numeric",
  );
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

export function previousReadingIssue(
  hasEarlierPeriod: boolean,
  context?: { floorName: string; serviceName: string },
): ValidationIssue {
  const prefix = context ? `${context.floorName} / ${context.serviceName}: ` : "";
  if (!hasEarlierPeriod) {
    return {
      code: "reading.opening",
      severity: "warning",
      message: `${prefix}Lectura inicial. El consumo se calculará en el siguiente período.`,
    };
  }
  return {
    code: "reading.missing_previous",
    severity: "warning",
    message: `${prefix}No hay una lectura anterior aprobada. El consumo no se puede calcular todavía.`,
  };
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

  if (input.previousApproved === null) {
    issues.push(previousReadingIssue(input.hasEarlierPeriod));
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

const SERVICE_ISSUE_NAMES: Record<ServiceCode, string> = {
  energia: "Energía",
  agua: "Agua",
  alcantarillado: "Alcantarillado",
};

export function validateBillCharges(charges: BillChargeValueMap): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [serviceCode, fields] of Object.entries(BILL_CHARGE_CATALOG)) {
    if (!isServiceCode(serviceCode)) {
      continue;
    }
    const serviceName = SERVICE_ISSUE_NAMES[serviceCode];
    for (const field of fields) {
      const amount = charges[serviceCode][field.code];
      if (amount === null || amount === undefined) {
        issues.push({
          code: "bill.charge_missing",
          severity: "error",
          message: `Falta el importe de ${serviceName}: ${field.label}.`,
        });
      }
    }
  }

  return issues;
}

export function validateBill(input: {
  energy: number | null;
  water: number | null;
  sewer: number | null;
  hasPdf: boolean;
  charges: BillChargeValueMap;
  otherServicesApSubtotal: number | null;
}): ValidationIssue[] {
  const issues = [
    ...validateBillTotals({
      energy: input.energy,
      water: input.water,
      sewer: input.sewer,
      hasPdf: input.hasPdf,
    }),
    ...validateBillCharges(input.charges),
  ];

  if (input.otherServicesApSubtotal === null) {
    issues.push({
      code: "bill.other_services_ap_missing",
      severity: "error",
      message: "Falta el subtotal de otros servicios + AP (alumbrado público).",
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
