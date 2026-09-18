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
  const open = periods.find((item) => item.status === "open");

  return (
    <>
      <AppHeader user={user} title="Administración" />
      <PageMain>
        {periods.length === 0 ? (
          <div className="empty-start">
            <p className="kicker">Empezar</p>
            <h2>Crea el primer período</h2>
            <p>
              Usa las fechas de las lecturas más antiguas que tengas. Eso deja la
              referencia de Piso 1 y Piso 2. El recibo se liquida en el período
              siguiente.
            </p>
            <Link href="/admin/periodos/nuevo" className="btn btn-primary">
              Crear el primer período
            </Link>
          </div>
        ) : (
          <>
            {open ? (
              <aside className="now-card mb-8">
                <p className="kicker">Continúa aquí</p>
                <h2>{open.label}</h2>
                <p>
                  Entra a este período para cargar el recibo, revisar las fotos de
                  Piso 1 y Piso 2, y ver cuánto paga cada piso.
                </p>
                <Link href={`/admin/periodos/${open.id}`} className="btn btn-primary">
                  Abrir el período
                </Link>
              </aside>
            ) : current ? (
              <p className="muted mb-6 text-[0.95rem]">
                No hay un período abierto. El más reciente es{" "}
                <Link className="link-quiet" href={`/admin/periodos/${current.id}`}>
                  {current.label}
                </Link>
                . Crea uno nuevo cuando llegue el siguiente recibo.
              </p>
            ) : null}
            <SectionHeading
              action={
                <Link href="/admin/periodos/nuevo" className="btn btn-primary">
                  Crear período
                </Link>
              }
            >
              Períodos
            </SectionHeading>
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
          </>
        )}
      </PageMain>
    </>
  );
}
