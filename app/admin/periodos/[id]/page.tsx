import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { BillForm } from "@/components/bill-form";
import { IssueList } from "@/components/issue-list";
import { PeriodGuide, type GuideStep } from "@/components/period-guide";
import { PeriodActions } from "@/components/period-actions";
import { PeriodStatusBadge, ReadingStatusBadge, MissingBadge } from "@/components/status-badge";
import { ReadingReviewCard } from "@/components/reading-review-card";
import { SettlementPanel } from "@/components/settlement-panel";
import { FloorBand, PageMain, WorkPanel } from "@/components/ui";
import { Amount } from "@/components/amount";
import { loadPeriodDetail, numericOrEmpty } from "@/lib/data/period-detail";
import { billChargeFields, billChargeLookup } from "@/lib/domain/bill-charges";
import { floorDisplayName } from "@/lib/domain/floors";
import { canClosePeriod } from "@/lib/domain/period-status";
import {
  formatDate,
  formatDateTime,
  previousReadingDisplay,
  consumptionDisplay,
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
    isOpeningPeriod ||
    (consumptions.allMeteredCalculable && !consumptions.hasNegativeUnmetered);
  const guide = buildAdminGuide({
    isOpeningPeriod,
    billComplete,
    allApproved,
    consumptionsOk,
    hasSettlement: Boolean(settlement),
    status: period.status,
    canMarkReady: readiness.ready,
  });

  return (
    <>
      <AppHeader
        user={user}
        title={period.label}
        crumbs={[{ href: "/admin", label: "Períodos" }]}
      />
      <PageMain variant="guided">
        <div className="period-with-guide">
          <div className="period-flow stack-xl">
          <section className="period-hero">
            <div className="period-hero-copy">
              <PeriodStatusBadge status={period.status} label={statusLabel} />
              <h2>{period.label}</h2>
              <p>
                {formatDate(period.starts_on)} — {formatDate(period.ends_on)}
              </p>
            </div>
          </section>

          {isOpeningPeriod ? (
            <p className="notice notice-warning max-w-[46rem]">
              Este es el período más antiguo. Sirve para guardar las lecturas de
              referencia. No hace falta el recibo. El cobro se calcula desde el
              período siguiente.
            </p>
          ) : null}

          <WorkPanel
            id="recibo"
            step={1}
            kicker="Paso 1"
            title="Recibo de la casa"
            hint={
              isOpeningPeriod
                ? "En el período inicial el recibo es opcional. Si lo cargas se guarda, pero no se usa para calcular consumos."
                : "Empieza por aquí. Carga el PDF y copia los números del recibo. Sin esto no se puede liquidar."
            }
          >
            {isOpeningPeriod ? null : <IssueList issues={billIssues} />}
            <BillForm
              periodId={period.id}
              notes={bill?.notes ?? ""}
              hasPdf={Boolean(bill?.pdf_storage_path)}
              existingPdfUrl={pdfUrl}
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
          </WorkPanel>

          <WorkPanel
            id="lecturas"
            step={2}
            kicker="Paso 2"
            title="Lecturas por piso"
            hint="Piso 1 y Piso 2 tienen contador. Entra a cada bloque, mira la foto y aprueba el número. Piso 3 no tiene contador: se calcula solo."
          >
            <div className="stack-lg">
              {catalog.floors.map((floor) => {
                const floorMeters = catalog.meters.filter(
                  (meter) => meter.floorId === floor.id,
                );
                const floorCards = readingCards.filter(
                  (card) => card.meter.floorId === floor.id,
                );
                const floorLines = consumptions.lines.filter(
                  (line) => line.floorId === floor.id,
                );
                const energyLine = floorLines.find((line) => line.serviceCode === "energia");
                const waterLine = floorLines.find((line) => line.serviceCode === "agua");

                return (
                  <FloorBand
                    key={floor.id}
                    id={floorAnchor(floor.code, floor.sortOrder)}
                    tone={floorTone(floor.sortOrder)}
                    name={floor.name}
                    occupant={floor.occupantName}
                    status={
                      <ul className="floor-band-status">
                        {floorMeters.length === 0 ? (
                          <li className="muted">Sin contador · se calcula por diferencia</li>
                        ) : (
                          floorMeters.map((meter) => {
                            const card = floorCards.find(
                              (item) => item.meter.serviceId === meter.serviceId,
                            );
                            const service = catalog.services.find(
                              (item) => item.id === meter.serviceId,
                            );
                            return (
                              <li key={`${meter.floorId}-${meter.serviceId}`}>
                                <span>{service?.name}</span>
                                {card?.reading ? (
                                  <ReadingStatusBadge status={card.reading.status} />
                                ) : (
                                  <MissingBadge />
                                )}
                              </li>
                            );
                          })
                        )}
                        {waterLine?.consumption != null ? (
                          <li className="muted">
                            Agua <Amount value={waterLine.consumption} />
                          </li>
                        ) : null}
                        {energyLine?.consumption != null ? (
                          <li className="muted">
                            Energía <Amount value={energyLine.consumption} />
                          </li>
                        ) : null}
                      </ul>
                    }
                  >
                    {floorMeters.length === 0 ? (
                      <p className="floor-empty">
                        Este piso no tiene contador. Su consumo es el del recibo menos
                        Piso 1 menos Piso 2. No hay foto que revisar aquí.
                      </p>
                    ) : (
                      floorCards.map((card) => (
                        <div key={`${card.meter.floorId}-${card.meter.serviceId}`}>
                          <ReadingReviewCard
                            periodId={period.id}
                            floorId={card.meter.floorId}
                            floorName={floorDisplayName(
                              card.floor?.name ?? "",
                              card.floor?.occupantName,
                            )}
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
                      ))
                    )}
                  </FloorBand>
                );
              })}
            </div>
          </WorkPanel>

          <WorkPanel
            id="consumos"
            step={3}
            kicker="Paso 3"
            title="Consumos"
            hint={
              isOpeningPeriod
                ? "En el período inicial no hay consumo: estas lecturas son la base del siguiente."
                : "Revisa que cada piso tenga un consumo con sentido. Si Piso 3 sale negativo, las lecturas o el recibo no cuadran."
            }
          >
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
                        {line.previous === null ? (
                          previousReadingDisplay(
                            line.previous,
                            isOpeningPeriod && line.source === "meter",
                          )
                        ) : (
                          <Amount value={line.previous} />
                        )}
                      </td>
                      <td>
                        <Amount value={line.current} />
                      </td>
                      <td>
                        {line.consumption === null ? (
                          consumptionDisplay(
                            line.consumption,
                            isOpeningPeriod && line.source === "meter",
                          )
                        ) : (
                          <Amount value={line.consumption} />
                        )}
                        {line.issues.length > 0 ? " ⚠" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <IssueList issues={consumptions.lines.flatMap((line) => line.issues)} />
          </WorkPanel>

          <SettlementPanel
            settlement={settlement}
            unavailableMessage={settlementUnavailableMessage}
            isOpeningPeriod={isOpeningPeriod}
          />

          <WorkPanel
            id="cierre"
            step={5}
            kicker="Paso 5"
            title="Cerrar el período"
            hint={
              period.status === "closed"
                ? "Este período ya está cerrado. El recibo y las lecturas no se cambian hasta reabrirlo."
                : period.status === "ready"
                  ? "La liquidación ya se puede usar. Cierra el período cuando hayas revisado cuánto paga cada piso."
                  : "Cuando el recibo esté completo y las lecturas aprobadas, marca el período como listo. Después podrás cerrarlo."
            }
          >
            <IssueList issues={readiness.blockers} />
            <PeriodActions
              periodId={period.id}
              periodLabel={period.label}
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
          </WorkPanel>
          </div>
          <PeriodGuide {...guide} />
        </div>
      </PageMain>
    </>
  );
}

function floorAnchor(code: string, sortOrder: number): string {
  return code || `piso-${sortOrder}`;
}

function floorTone(sortOrder: number): 1 | 2 | 3 {
  if (sortOrder <= 1) {
    return 1;
  }
  if (sortOrder === 2) {
    return 2;
  }
  return 3;
}

function buildAdminGuide(input: {
  isOpeningPeriod: boolean;
  billComplete: boolean;
  allApproved: boolean;
  consumptionsOk: boolean;
  hasSettlement: boolean;
  status: "open" | "ready" | "closed";
  canMarkReady: boolean;
}): {
  nextTitle: string;
  nextDetail: string;
  nextHref: string;
  nextLabel: string;
  steps: GuideStep[];
} {
  const reciboState: GuideStep["state"] = input.isOpeningPeriod
    ? input.billComplete
      ? "done"
      : "optional"
    : input.billComplete
      ? "done"
      : "wait";
  const lecturasState: GuideStep["state"] = input.allApproved ? "done" : "wait";
  const consumosState: GuideStep["state"] = input.isOpeningPeriod
    ? "optional"
    : input.consumptionsOk
      ? "done"
      : "wait";
  const liquidacionState: GuideStep["state"] = input.isOpeningPeriod
    ? "optional"
    : input.hasSettlement
      ? "done"
      : "wait";
  const cierreState: GuideStep["state"] =
    input.status === "closed" ? "done" : "wait";

  const steps: GuideStep[] = [
    {
      href: "#recibo",
      n: 1,
      title: "Recibo",
      detail: input.isOpeningPeriod
        ? "Opcional en el período inicial"
        : "Cargar el PDF y copiar los números",
      state: reciboState,
    },
    {
      href: "#lecturas",
      n: 2,
      title: "Lecturas",
      detail: "Revisar fotos de Piso 1 y Piso 2",
      state: lecturasState,
    },
    {
      href: "#consumos",
      n: 3,
      title: "Consumos",
      detail: input.isOpeningPeriod
        ? "No aplica todavía"
        : "Comprobar que Piso 3 no quede negativo",
      state: consumosState,
    },
    {
      href: "#liquidacion",
      n: 4,
      title: "Liquidación",
      detail: input.isOpeningPeriod
        ? "Este período no se liquida"
        : "Ver cuánto paga cada piso",
      state: liquidacionState,
    },
    {
      href: "#cierre",
      n: 5,
      title: "Cerrar",
      detail:
        input.status === "closed"
          ? "Ya está cerrado"
          : "Marcar listo y luego cerrar",
      state: cierreState,
    },
  ];

  let currentHref = "#cierre";
  if (!input.isOpeningPeriod && !input.billComplete) {
    currentHref = "#recibo";
  } else if (!input.allApproved) {
    currentHref = "#lecturas";
  } else if (!input.isOpeningPeriod && !input.consumptionsOk) {
    currentHref = "#consumos";
  } else if (!input.isOpeningPeriod && !input.hasSettlement) {
    currentHref = "#liquidacion";
  } else if (input.status !== "closed") {
    currentHref = "#cierre";
  }

  for (const step of steps) {
    if (step.href === currentHref && step.state === "wait") {
      step.state = "current";
    }
  }

  if (input.status === "closed") {
    return {
      nextTitle: "Período cerrado",
      nextDetail:
        "Ya no se cambia el recibo ni las lecturas. Si hace falta corregir algo, reabre el período.",
      nextHref: "#cierre",
      nextLabel: "Ir al cierre",
      steps,
    };
  }

  if (!input.isOpeningPeriod && !input.billComplete) {
    return {
      nextTitle: "Carga el recibo",
      nextDetail:
        "Pulsa el botón verde para elegir el PDF. Luego copia los números y, al final, Guardar recibo.",
      nextHref: "#recibo",
      nextLabel: "Ir al recibo",
      steps,
    };
  }

  if (!input.allApproved) {
    return {
      nextTitle: input.isOpeningPeriod
        ? "Registra las lecturas de referencia"
        : "Revisa las lecturas",
      nextDetail: input.isOpeningPeriod
        ? "No hace falta recibo. En Piso 1 y Piso 2 entra energía y agua, sube la foto y aprueba el número."
        : "Entra a Piso 1 y después a Piso 2. Compara cada foto con el número y aprueba o pide corrección.",
      nextHref: "#lecturas",
      nextLabel: "Ir a las lecturas",
      steps,
    };
  }

  if (!input.isOpeningPeriod && !input.consumptionsOk) {
    return {
      nextTitle: "Revisa los consumos",
      nextDetail:
        "Algo no cuadra: falta una lectura anterior o el Piso 3 quedó negativo. Corrige lecturas o totales del recibo.",
      nextHref: "#consumos",
      nextLabel: "Ir a los consumos",
      steps,
    };
  }

  if (!input.isOpeningPeriod && !input.hasSettlement) {
    return {
      nextTitle: "Falta la liquidación",
      nextDetail:
        "Cuando el recibo y los consumos estén completos, aquí aparece cuánto paga cada piso.",
      nextHref: "#liquidacion",
      nextLabel: "Ir a la liquidación",
      steps,
    };
  }

  if (input.status === "open" && input.canMarkReady) {
    return {
      nextTitle: "Marca el período como listo",
      nextDetail: input.isOpeningPeriod
        ? "Las lecturas de referencia ya están. Márcalo listo y luego crea el período del recibo actual."
        : "Recibo, lecturas y liquidación ya están. Si se ve bien, marca el período como listo.",
      nextHref: "#cierre",
      nextLabel: "Ir a cerrar",
      steps,
    };
  }

  return {
    nextTitle: "Cierra el período",
    nextDetail:
      "Mira cuánto paga cada piso. Si está correcto, cierra para que nadie cambie el recibo ni las lecturas.",
    nextHref: "#cierre",
    nextLabel: "Ir a cerrar",
    steps,
  };
}
