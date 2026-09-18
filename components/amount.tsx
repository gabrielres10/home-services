import { formatMoney, formatNumber } from "@/lib/format";

export function Amount({
  value,
  kind = "quantity",
  fallback = "—",
}: {
  value: number | null | undefined;
  kind?: "quantity" | "money";
  fallback?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  const formatted = kind === "money" ? formatMoney(value) : formatNumber(value);
  return (
    <span className={value < 0 ? "numeric-negative" : undefined}>{formatted}</span>
  );
}
