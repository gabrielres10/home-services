import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { BillForm } from "@/components/bill-form";
import { IssueList } from "@/components/issue-list";
import { PeriodActions } from "@/components/period-actions";
import { PeriodStatusBadge, ReadingStatusBadge, MissingBadge } from "@/components/status-badge";
import { ReadingReviewCard } from "@/components/reading-review-card";
import { loadPeriodDetail, numericOrEmpty } from "@/lib/data/period-detail";
import { consumptionDisplay, formatDate, formatDateTime, formatNumber, previousReadingDisplay } from "@/lib/format";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const detail = await loadPeriodDetail(id);
  if (!detail) {
    notFound();
  }

  const {
    period,
    catalog,
    bill,
    billIssues,
    pdfUrl,
    totalsByCode,
    readingCards,
    consumptions,
    counts,
    readiness,
    isOpeningPeriod,
    statusLabel,
  } = detail;

  const allApproved = counts.approvedCount === counts.expectedCount && counts.missingCount === 0;

  return (
    <>
      <AppHeader user={user} title={period.label} />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <section className="rounded border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">{period.label}</h2>
              <p className="text-sm text-stone-600">
                {formatDate(period.starts_on)} — {formatDate(period.ends_on)}
              </p>
            </div>
            <PeriodStatusBadge status={period.status} label={statusLabel} />
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            <li>Recibo {bill?.pdf_storage_path ? "✓ Cargado" : isOpeningPeriod ? "Opcional (período inicial)" : "✗ Pendiente"}</li>
            <li>
              Lecturas {counts.approvedCount}/{counts.expectedCount} aprobadas
            </li>
            {allApproved ? <li>✓ Todas las lecturas recibidas y aprobadas</li> : null}
            {isOpeningPeriod ? (
              <li>Período inicial: estas lecturas son la referencia del siguiente período</li>
            ) : consumptions.allMeteredCalculable && !consumptions.hasNegativeUnmetered ? (
              <li>✓ Consumos calculados</li>
            ) : (
              <li>Consumos pendientes o con error</li>
            )}
          </ul>
          {isOpeningPeriod ? (
            <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Este es el período con la fecha inicial más antigua. Sus lecturas aprobadas
              quedan como referencia. El consumo se calcula a partir del siguiente período,
              aunque ambos compartan el día de lectura.
            </p>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recibo</h2>
          {isOpeningPeriod ? (
            <p className="text-sm text-stone-600">
              El recibo es opcional en el período inicial. Si lo cargas, se guarda, pero no
              se usa para calcular consumos.
            </p>
          ) : (
            <IssueList issues={billIssues} />
          )}
          <BillForm
            periodId={period.id}
            notes={bill?.notes ?? ""}
            hasPdf={Boolean(bill?.pdf_storage_path)}
            services={catalog.services.map((service) => ({
              code: service.code,
              name: service.name,
              unit: service.unit,
              value: numericOrEmpty(totalsByCode.get(service.code) ?? null),
            }))}
          />
          {pdfUrl ? (
            <iframe
              title="Recibo PDF"
              src={pdfUrl}
              className="h-[32rem] w-full rounded border border-stone-200 bg-white"
            />
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Lecturas</h2>
          {catalog.floors.map((floor) => {
            const floorMeters = catalog.meters.filter((meter) => meter.floorId === floor.id);
            if (floorMeters.length === 0) {
              return (
                <div key={floor.id} className="rounded border border-stone-200 bg-white p-4">
                  <h3 className="font-medium">{floor.name}</h3>
                  <p className="text-sm text-stone-600">Calculado automáticamente</p>
                </div>
              );
            }
            return (
              <div key={floor.id} className="space-y-2">
                <h3 className="font-medium">{floor.name}</h3>
                {floorMeters.map((meter) => {
                  const card = readingCards.find(
                    (item) =>
                      item.meter.floorId === meter.floorId &&
                      item.meter.serviceId === meter.serviceId,
                  );
                  const service = catalog.services.find((item) => item.id === meter.serviceId);
                  return (
                    <p key={`${meter.floorId}-${meter.serviceId}`} className="flex items-center gap-2 text-sm">
                      <span className="w-28">{service?.name}</span>
                      {card?.reading ? (
                        <ReadingStatusBadge status={card.reading.status} />
                      ) : (
                        <MissingBadge />
                      )}
                    </p>
                  );
                })}
              </div>
            );
          })}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Revisión</h2>
          {readingCards.map((card) => (
            <div key={`${card.meter.floorId}-${card.meter.serviceId}`} className="space-y-2">
              <ReadingReviewCard
                periodId={period.id}
                floorId={card.meter.floorId}
                floorName={card.floor?.name ?? ""}
                serviceId={card.meter.serviceId}
                serviceName={card.service?.name ?? ""}
                unit={card.service?.unit ?? ""}
                readingId={card.reading?.id ?? null}
                status={card.reading?.status ?? null}
                submittedValue={
                  card.reading ? Number(card.reading.submitted_value) : null
                }
                value={card.reading ? Number(card.reading.value) : null}
                previousValue={card.previous}
                consumption={card.consumption}
                photoUrl={card.photoUrl}
                readingDate={card.reading?.reading_date ?? period.ends_on}
                rejectionReason={card.reading?.rejection_reason ?? null}
                issues={card.issues}
                warningsNeedConfirm={card.warningsNeedConfirm}
                isOpeningPeriod={isOpeningPeriod}
              />
              {card.audits.length > 0 ? (
                <details className="rounded border border-stone-200 bg-white px-4 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">Historial</summary>
                  <ul className="mt-2 space-y-1 text-stone-600">
                    {card.audits.map((audit) => (
                      <li key={audit.id}>
                        {formatDateTime(audit.occurred_at)} · {audit.action}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Consumos</h2>
          <div className="overflow-x-auto rounded border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-3 py-2">Piso</th>
                  <th className="px-3 py-2">Servicio</th>
                  <th className="px-3 py-2">Origen</th>
                  <th className="px-3 py-2">Anterior</th>
                  <th className="px-3 py-2">Actual</th>
                  <th className="px-3 py-2">Consumo</th>
                </tr>
              </thead>
              <tbody>
                {consumptions.lines.map((line) => (
                  <tr key={`${line.floorId}-${line.serviceId}`} className="border-t border-stone-100">
                    <td className="px-3 py-2">{line.floorName}</td>
                    <td className="px-3 py-2">{line.serviceName}</td>
                    <td className="px-3 py-2">
                      {line.source === "meter"
                        ? "Contador"
                        : line.source === "difference"
                          ? "Diferencia"
                          : "Igual que agua"}
                    </td>
                    <td className="px-3 py-2">{previousReadingDisplay(line.previous, isOpeningPeriod && line.source === "meter")}</td>
                    <td className="px-3 py-2">{formatNumber(line.current)}</td>
                    <td className="px-3 py-2">
                      {consumptionDisplay(line.consumption, isOpeningPeriod && line.source === "meter")}
                      {line.issues.length > 0 ? " ⚠" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <IssueList
            issues={consumptions.lines.flatMap((line) => line.issues)}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Estado del período</h2>
          <IssueList issues={readiness.blockers} />
          <PeriodActions
            periodId={period.id}
            status={period.status}
            canMarkReady={readiness.ready}
            settlementMessage="Las fórmulas de liquidación todavía no están definidas. Cuando se especifiquen se incorporarán en CalculationEngine."
          />
        </section>
      </main>
    </>
  );
}
