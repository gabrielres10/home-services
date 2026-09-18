const NUMERIC_COMPLETE = /^-?\d+(,\d+)?$/;
const NUMERIC_DRAFT = /^-?$|^-?\d+$|^-?\d+,$|^-?\d+,\d+$/;

export function isNumericDraft(raw: string): boolean {
  return NUMERIC_DRAFT.test(raw);
}

export function isCompleteNumeric(raw: string): boolean {
  return NUMERIC_COMPLETE.test(raw);
}

export function parseNumericRaw(raw: string): number | null {
  if (!NUMERIC_COMPLETE.test(raw)) {
    return null;
  }
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function explainNumericReject(raw: string): string {
  if (raw === "") {
    return "El número está vacío.";
  }
  if (raw.includes(".") || /\s/.test(raw) || raw.includes("\u00a0")) {
    return "No uses puntos ni espacios. Escribe 100000 sin miles. El decimal va con coma: 1,5.";
  }
  if ((raw.match(/,/g) ?? []).length > 1) {
    return "Solo una coma para los decimales.";
  }
  const minusCount = (raw.match(/-/g) ?? []).length;
  if (minusCount > 1 || raw.indexOf("-") > 0) {
    return "El menos solo puede ir al principio, para un valor negativo.";
  }
  return "Solo se admiten dígitos, una coma decimal y un menos al inicio si es negativo.";
}

export function numberToInputRaw(
  value: number,
  maximumFractionDigits = 8,
): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  const raw = value.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits,
  });
  return raw.replace(".", ",");
}

export function formatGroupedFromRaw(
  raw: string,
  kind: "quantity" | "money",
): string | null {
  if (!NUMERIC_COMPLETE.test(raw)) {
    return null;
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const commaAt = unsigned.indexOf(",");
  const intPart = commaAt === -1 ? unsigned : unsigned.slice(0, commaAt);
  const decPart = commaAt === -1 ? null : unsigned.slice(commaAt + 1);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = decPart !== null ? `${grouped},${decPart}` : grouped;
  if (kind === "money") {
    return negative ? `-$${body}` : `$${body}`;
  }
  return negative ? `-${body}` : body;
}

export function formatQuantityValue(value: number, maximumFractionDigits = 3): string {
  return (
    formatGroupedFromRaw(numberToInputRaw(value, maximumFractionDigits), "quantity") ??
    String(value)
  );
}

export function formatMoneyValue(value: number, maximumFractionDigits = 2): string {
  return (
    formatGroupedFromRaw(numberToInputRaw(value, maximumFractionDigits), "money") ??
    String(value)
  );
}
