import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { PeriodStatusBadge } from "@/components/status-badge";
import { PageMain, SectionHeading } from "@/components/ui";
import { loadPeriodList } from "@/lib/data/period-detail";

export default async function AdminHomePage() {
  const user = await requireAdmin();
  const periods = await loadPeriodList();
  const current = periods.find((item) => item.status === "open") ?? periods[0];

  return (
    <>
      <AppHeader user={user} title="Administración" />
      <PageMain>
        <SectionHeading
          action={
            <Link href="/admin/periodos/nuevo" className="btn btn-primary">
              Crear período
            </Link>
          }
        >
          Períodos
        </SectionHeading>
        {current ? (
          <p className="muted mb-6 text-[0.95rem]">
            Período actual:{" "}
            <Link className="link-quiet" href={`/admin/periodos/${current.id}`}>
              {current.label}
            </Link>
          </p>
        ) : (
          <p className="muted mb-6 max-w-[40rem] text-[0.95rem]">
            Todavía no hay períodos. Crea primero el período más antiguo: sus lecturas
            aprobadas serán la referencia inicial. El consumo se calcula desde el
            siguiente período.
          </p>
        )}
        <ul className="period-ledger">
          {periods.map((period) => {
            const progress =
              period.counts.expectedCount > 0
                ? Math.round(
                    (period.counts.approvedCount / period.counts.expectedCount) * 100,
                  )
                : 0;
            return (
              <li key={period.id}>
                <Link
                  href={`/admin/periodos/${period.id}`}
                  className={`period-row${period.id === current?.id ? " is-current" : ""}`}
                >
                  <div className="period-row-top">
                    <h3 className="period-row-label">{period.label}</h3>
                    <PeriodStatusBadge status={period.status} label={period.statusLabel} />
                  </div>
                  <p className="period-row-meta">
                    Lecturas: {period.counts.approvedCount}/{period.counts.expectedCount}{" "}
                    aprobadas
                    {period.counts.missingCount > 0
                      ? ` · ${period.counts.missingCount} sin enviar`
                      : ""}
                    {period.counts.pendingCount > 0
                      ? ` · ${period.counts.pendingCount} pendientes`
                      : ""}
                  </p>
                  {period.id === current?.id && period.counts.expectedCount > 0 ? (
                    <div className="reading-meter" aria-hidden>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </PageMain>
    </>
  );
}
