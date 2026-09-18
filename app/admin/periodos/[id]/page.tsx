import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { BillForm } from "@/components/bill-form";
import { IssueList } from "@/components/issue-list";
import { PeriodActions } from "@/components/period-actions";
import { PeriodStatusBadge, ReadingStatusBadge, MissingBadge } from "@/components/status-badge";
import { ReadingReviewCard } from "@/components/reading-review-card";
import { SettlementPanel } from "@/components/settlement-panel";
import { PageMain, SectionHeading } from "@/components/ui";
import { loadPeriodDetail, numericOrEmpty } from "@/lib/data/period-detail";
import { billChargeFields, billChargeLookup } from "@/lib/domain/bill-charges";
import { canClosePeriod } from "@/lib/domain/period-status";
import {
  consumptionDisplay,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  previousReadingDisplay,
} from "@/lib/format";

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
    chargeValues,
    readingCards,
    consumptions,
    counts,
    readiness,
    isOpeningPeriod,
    statusLabel,
    settlement,
    settlementUnavailableMessage,
  } = detail;

  const allApproved = counts.approvedCount === counts.expectedCount && counts.missingCount === 0;
  const billComplete = billIssues.filter((issue) => issue.severity === "error").length === 0;
  const periodLocked = period.status !== "open";
  const canClose = canClosePeriod({
    status: period.status,
    isOpeningPeriod,
    hasSettlement: Boolean(settlement),
  });
  const consumptionsOk =
    consumptions.allMeteredCalculable && !consumptions.hasNegativeUnmetered;

  return (
    <>
      <AppHeader
        user={user}
        title={period.label}
        crumbs={[{ href: "/admin", label: "Períodos" }]}
      />
      <PageMain>
        <div className="stack-xl">
          <section className="period-hero">
            <div className="period-hero-copy">
              <PeriodStatusBadge status={period.status} label={statusLabel} />
              <h2>{period.label}</h2>
              <p>
                {formatDate(period.starts_on)} — {formatDate(period.ends_on)}
              </p>
            </div>
            <ul className="status-list">
              <li className={statusClass(billComplete, !billComplete && !isOpeningPeriod)}>
                Recibo{" "}
                {billComplete
                  ? "Completo"
                  : isOpeningPeriod
                    ? "Opcional (período inicial)"
                    : "Incompleto"}
              </li>
              <li className={statusClass(allApproved, counts.missingCount > 0)}>
                Lecturas {counts.approvedCount}/{counts.expectedCount} aprobadas
              </li>
              {allApproved ? (
                <li className="status-item is-done">Todas las lecturas recibidas y aprobadas</li>
              ) : null}
              {isOpeningPeriod ? (
                <li className="status-item is-done">
                  Período inicial: estas lecturas son la referencia del siguiente período
                </li>
              ) : (
                <li className={statusClass(consumptionsOk, consumptions.hasNegativeUnmetered)}>
                  {consumptionsOk ? "Consumos calculados" : "Consumos pendientes o con error"}
                </li>
              )}
              {isOpeningPeriod ? null : (
                <li className={statusClass(Boolean(settlement))}>
                  {settlement ? "Liquidación calculada" : "Liquidación pendiente"}
                </li>
              )}
            </ul>
          </section>

          {isOpeningPeriod ? (
            <p className="notice notice-warning max-w-[46rem]">
              Este es el período con la fecha inicial más antigua. Sus lecturas aprobadas
              quedan como referencia. El consumo se calcula a partir del siguiente período,
              aunque ambos compartan el día de lectura.
            </p>
          ) : null}

          <section>
            <SectionHeading kicker="Cuenta de la casa">Recibo</SectionHeading>
            {isOpeningPeriod ? (
              <p className="muted mb-5 max-w-[42rem] text-[0.95rem]">
                El recibo es opcional en el período inicial. Si lo cargas, se guarda, pero no
                se usa para calcular consumos.
              </p>
            ) : (
              <div className="mb-5">
                <IssueList issues={billIssues} />
              </div>
            )}
            <BillForm
              periodId={period.id}
              notes={bill?.notes ?? ""}
              hasPdf={Boolean(bill?.pdf_storage_path)}
              otherServicesApSubtotal={numericOrEmpty(bill?.other_services_ap_subtotal ?? null)}
              locked={period.status === "closed"}
              services={catalog.services.map((service) => ({
                code: service.code,
                name: service.name,
                unit: service.unit,
                value: numericOrEmpty(totalsByCode.get(service.code) ?? null),
                charges: billChargeFields(service.code).map((field) => ({
                  code: field.code,
                  label: field.label,
                  value: numericOrEmpty(
                    billChargeLookup(chargeValues, service.code, field.code),
                  ),
                })),
              }))}
            />
            {catalog.services.some((service) =>
              billChargeFields(service.code).some(
                (field) => billChargeLookup(chargeValues, service.code, field.code) !== null,
              ),
            ) ? (
              <div className="ledger-wrap mt-8">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th>Servicio</th>
                      <th>Renglón</th>
                      <th>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.services.flatMap((service) =>
                      billChargeFields(service.code).map((field) => (
                        <tr key={`${service.code}-${field.code}`}>
                          <td>{service.name}</td>
                          <td>{field.label}</td>
                          <td>
                            {formatMoney(
                              billChargeLookup(chargeValues, service.code, field.code),
                            )}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
            {bill?.other_services_ap_subtotal != null ? (
              <p className="mt-4 text-[0.95rem]">
                Subtotal otros servicios + AP (alumbrado público):{" "}
                <strong className="figure">
                  {formatMoney(Number(bill.other_services_ap_subtotal))}
                </strong>
              </p>
            ) : null}
            {pdfUrl ? (
              <iframe title="Recibo PDF" src={pdfUrl} className="doc-frame mt-6" />
            ) : null}
          </section>

          <section>
            <SectionHeading kicker="Contadores">Lecturas</SectionHeading>
            <div className="meter-board">
              {catalog.floors.map((floor) => {
                const floorMeters = catalog.meters.filter((meter) => meter.floorId === floor.id);
                if (floorMeters.length === 0) {
                  return (
                    <div key={floor.id} className="meter-board-row">
                      <strong>{floor.name}</strong>
                      <span className="muted">Calculado automáticamente</span>
                    </div>
                  );
                }
                return (
                  <div key={floor.id} className="meter-board-row">
                    <strong>{floor.name}</strong>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {floorMeters.map((meter) => {
                        const card = readingCards.find(
                          (item) =>
                            item.meter.floorId === meter.floorId &&
                            item.meter.serviceId === meter.serviceId,
                        );
                        const service = catalog.services.find((item) => item.id === meter.serviceId);
                        return (
                          <span
                            key={`${meter.floorId}-${meter.serviceId}`}
                            className="flex items-center gap-2"
                          >
                            <span className="muted">{service?.name}</span>
                            {card?.reading ? (
                              <ReadingStatusBadge status={card.reading.status} />
                            ) : (
                              <MissingBadge />
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <SectionHeading kicker="Foto y valor">Revisión</SectionHeading>
            {readingCards.map((card) => (
              <div key={`${card.meter.floorId}-${card.meter.serviceId}`}>
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
                  locked={periodLocked}
                />
                {card.audits.length > 0 ? (
                  <details className="history-block">
                    <summary>Historial</summary>
                    <ul className="muted mt-2 space-y-1 text-[0.86rem]">
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

          <section>
            <SectionHeading kicker="Por piso">Consumos</SectionHeading>
            <div className="ledger-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Piso</th>
                    <th>Servicio</th>
                    <th>Origen</th>
                    <th>Anterior</th>
                    <th>Actual</th>
                    <th>Consumo</th>
                  </tr>
                </thead>
                <tbody>
                  {consumptions.lines.map((line) => (
                    <tr key={`${line.floorId}-${line.serviceId}`}>
                      <td>{line.floorName}</td>
                      <td>{line.serviceName}</td>
                      <td>
                        {line.source === "meter"
                          ? "Contador"
                          : line.source === "difference"
                            ? "Diferencia"
                            : "Igual que agua"}
                      </td>
                      <td>
                        {previousReadingDisplay(
                          line.previous,
                          isOpeningPeriod && line.source === "meter",
                        )}
                      </td>
                      <td>{formatNumber(line.current)}</td>
                      <td>
                        {consumptionDisplay(
                          line.consumption,
                          isOpeningPeriod && line.source === "meter",
                        )}
                        {line.issues.length > 0 ? " ⚠" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <IssueList issues={consumptions.lines.flatMap((line) => line.issues)} />
            </div>
          </section>

          <SettlementPanel
            settlement={settlement}
            unavailableMessage={settlementUnavailableMessage}
            isOpeningPeriod={isOpeningPeriod}
          />

          <section>
            <SectionHeading kicker="Cierre">Estado del período</SectionHeading>
            <IssueList issues={readiness.blockers} />
            <div className="mt-4">
              <PeriodActions
                periodId={period.id}
                status={period.status}
                canMarkReady={readiness.ready}
                canClose={canClose}
                closeBlockedMessage={
                  period.status === "ready" && !canClose
                    ? (settlementUnavailableMessage ??
                      "La liquidación todavía no se puede calcular.")
                    : null
                }
              />
            </div>
          </section>
        </div>
      </PageMain>
    </>
  );
}

function statusClass(done: boolean, blocked = false) {
  if (blocked) {
    return "status-item is-blocked";
  }
  if (done) {
    return "status-item is-done";
  }
  return "status-item is-wait";
}
