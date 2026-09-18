import type { PeriodStatus, ReadingStatus } from "@/lib/domain/types";

const readingStyles: Record<ReadingStatus, string> = {
  pending: "badge-pending",
  approved: "badge-approved",
  rejected: "badge-rejected",
};

const readingLabels: Record<ReadingStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const periodStyles: Record<PeriodStatus, string> = {
  open: "badge-open",
  ready: "badge-ready",
  closed: "badge-closed",
};

export function ReadingStatusBadge({ status }: { status: ReadingStatus }) {
  return <span className={`badge ${readingStyles[status]}`}>{readingLabels[status]}</span>;
}

export function PeriodStatusBadge({
  status,
  label,
}: {
  status: PeriodStatus;
  label: string;
}) {
  return <span className={`badge ${periodStyles[status]}`}>{label}</span>;
}

export function MissingBadge() {
  return <span className="badge badge-missing">Sin enviar</span>;
}
