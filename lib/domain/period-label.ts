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
