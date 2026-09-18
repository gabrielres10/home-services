import { formatMoneyValue, formatQuantityValue, numberToInputRaw } from "@/lib/domain/numeric";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return formatMoneyValue(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return formatQuantityValue(value);
}

export { numberToInputRaw };

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "—";
  }
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return dateTimeFormatter.format(new Date(iso));
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function previousReadingDisplay(
  value: number | null,
  isOpeningPeriod: boolean,
): string {
  if (value !== null) {
    return formatNumber(value);
  }
  return isOpeningPeriod ? "Lectura inicial" : "No hay lectura aprobada previa";
}

export function consumptionDisplay(
  value: number | null,
  isOpeningPeriod: boolean,
): string {
  if (value !== null) {
    return formatNumber(value);
  }
  return isOpeningPeriod ? "No aplica (período inicial)" : "No calculable todavía";
}
