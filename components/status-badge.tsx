import type { PeriodStatus, ReadingStatus } from "@/lib/domain/types";

const readingStyles: Record<ReadingStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
};

const readingLabels: Record<ReadingStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const periodStyles: Record<PeriodStatus, string> = {
  open: "bg-amber-100 text-amber-900",
  ready: "bg-green-100 text-green-900",
  closed: "bg-stone-200 text-stone-700",
};

export function ReadingStatusBadge({ status }: { status: ReadingStatus }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${readingStyles[status]}`}>
      {readingLabels[status]}
    </span>
  );
}

export function PeriodStatusBadge({
  status,
  label,
}: {
  status: PeriodStatus;
  label: string;
}) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${periodStyles[status]}`}>
      {label}
    </span>
  );
}

export function MissingBadge() {
  return (
    <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
      Sin enviar
    </span>
  );
}
