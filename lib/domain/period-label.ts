const MONTHS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
] as const;

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export function parseIsoDate(iso: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const monthName = MONTHS[month - 1];
  if (!monthName) {
    return null;
  }
  return { year, month, day };
}

function formatMonthDay(date: CalendarDate): string {
  const month = MONTHS[date.month - 1];
  return `${month} ${date.day}`;
}

export function periodLabelFromDates(startsOn: string, endsOn: string): string | null {
  const start = parseIsoDate(startsOn);
  const end = parseIsoDate(endsOn);
  if (!start || !end) {
    return null;
  }
  if (start.year === end.year) {
    return `(${start.year}) ${formatMonthDay(start)} a ${formatMonthDay(end)}`;
  }
  return `${start.year} ${formatMonthDay(start)} a ${end.year} ${formatMonthDay(end)}`;
}

export const SUGGESTED_PERIOD_LENGTH_DAYS = 30;

export function addCalendarDays(iso: string, days: number): string | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) {
    return null;
  }
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function suggestNextPeriodDates(lastEndsOn: string): {
  startsOn: string;
  endsOn: string;
} | null {
  const startsOn = addCalendarDays(lastEndsOn, 1);
  if (!startsOn) {
    return null;
  }
  const endsOn = addCalendarDays(startsOn, SUGGESTED_PERIOD_LENGTH_DAYS);
  if (!endsOn) {
    return null;
  }
  return { startsOn, endsOn };
}
