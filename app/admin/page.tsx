import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { PeriodStatusBadge } from "@/components/status-badge";
import { loadPeriodList } from "@/lib/data/period-detail";

export default async function AdminHomePage() {
  const user = await requireAdmin();
  const periods = await loadPeriodList();
  const current = periods.find((item) => item.status === "open") ?? periods[0];

  return (
    <>
      <AppHeader user={user} title="Administración" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Períodos</h2>
          <Link
            href="/admin/periodos/nuevo"
            className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800"
          >
            Crear período
          </Link>
        </div>
        {current ? (
          <p className="text-sm text-stone-600">
            Período actual:{" "}
            <Link className="underline" href={`/admin/periodos/${current.id}`}>
              {current.label}
            </Link>
          </p>
        ) : (
          <p className="text-sm text-stone-600">Todavía no hay períodos.</p>
        )}
        <ul className="space-y-3">
          {periods.map((period) => (
            <li key={period.id}>
              <Link
                href={`/admin/periodos/${period.id}`}
                className="block rounded border border-stone-200 bg-white p-4 hover:border-stone-400"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-medium">{period.label}</h3>
                  <PeriodStatusBadge status={period.status} label={period.statusLabel} />
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  Lecturas: {period.counts.approvedCount}/{period.counts.expectedCount}{" "}
                  aprobadas
                  {period.counts.missingCount > 0
                    ? ` · ${period.counts.missingCount} sin enviar`
                    : ""}
                  {period.counts.pendingCount > 0
                    ? ` · ${period.counts.pendingCount} pendientes`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
