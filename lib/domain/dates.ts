import { parseIsoDate, type CalendarDate } from "@/lib/domain/period-label";

export const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export const WEEKDAY_SHORT_ES = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;

export function formatChosenDate(iso: string): string | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) {
    return null;
  }
  const month = MONTH_NAMES_ES[parsed.month - 1];
  if (!month) {
    return null;
  }
  return `${parsed.day} / ${month} / ${parsed.year}`;
}

export function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function mondayFirstWeekday(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

export function monthGrid(year: number, month: number): Array<number | null> {
  const leading = mondayFirstWeekday(year, month, 1);
  const days = daysInMonth(year, month);
  const cells: Array<number | null> = [];
  for (let i = 0; i < leading; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function calendarFromIso(iso: string | null | undefined): CalendarDate | null {
  return iso ? parseIsoDate(iso) : null;
}
