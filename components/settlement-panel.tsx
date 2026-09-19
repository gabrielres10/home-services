import type { ReactNode } from "react";
import { IssueList } from "@/components/issue-list";
import { Amount } from "@/components/amount";
import { WorkPanel } from "@/components/ui";
import type { SettlementResult } from "@/lib/domain/settlement";
import { formatNumber } from "@/lib/format";

export function SettlementPanel({
  settlement,
  unavailableMessage,
  isOpeningPeriod,
}: {
  settlement: SettlementResult | null;
  unavailableMessage: string | null;
  isOpeningPeriod: boolean;
}) {
  if (!settlement) {
    return (
      <WorkPanel
        id="liquidacion"
        step={4}
        kicker="Paso 4"
        title="Liquidación"
        hint={
          unavailableMessage ??
          (isOpeningPeriod
            ? "El período inicial no se liquida."
            : "La liquidación aparece sola cuando el recibo y los consumos estén completos.")
        }
      >
        <p className="notice">
          Todavía no hay un cobro por piso. Completa los pasos de arriba.
        </p>
      </WorkPanel>
    );
  }

  const { rates, floors, totals } = settlement;

  return (
    <WorkPanel
      id="liquidacion"
      step={4}
      kicker="Paso 4"
      title="Cuánto paga cada piso"
      hint={`El recibo se reparte entre ${formatNumber(rates.floorCount)} pisos. Cada uno tiene ${formatNumber(rates.energyCapPerFloor)} kWh y ${formatNumber(rates.waterCapPerFloor)} m³ a tarifa subsidiada. Lo que se pase se cobra más caro. Mora, cargos fijos y alumbrado público se parten por igual.`}
    >
      {settlement.adjustments.length > 0 ? (
        <ul className="notice-list">
          {settlement.adjustments.map((message) => (
            <li key={message} className="notice notice-info">
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      <IssueList issues={settlement.notes} />

      <div className="floor-statements">
        {floors.map((floor, index) => (
          <article
            key={floor.floorId}
            className={`floor-statement floor-band-${index + 1}`}
          >
            <header>
              <p className="kicker">Piso</p>
              <h3>{floor.floorName}</h3>
            </header>
            <p className="floor-due">
              <span className="floor-due-label">A pagar</span>
              <strong className="floor-total">
                <Amount value={floor.total} kind="money" />
              </strong>
            </p>
            <ul className="floor-breakdown">
              <li>
                <div className="floor-breakdown-main">
                  <span className="floor-breakdown-name">Agua</span>
                  <span className="floor-breakdown-cost">
                    <Amount value={floor.waterCost} kind="money" />
                  </span>
                </div>
                <p className="floor-breakdown-qty">
                  <Amount value={floor.waterM3} /> m³
                </p>
                <p className="floor-breakdown-split">
                  <span>
                    <Amount value={floor.waterSubsidizedM3} /> m³ subsidio
                  </span>
                  <span>
                    <Amount value={floor.waterStandardM3} /> m³ estándar
                  </span>
                </p>
              </li>
              <li>
                <div className="floor-breakdown-main">
                  <span className="floor-breakdown-name">Energía</span>
                  <span className="floor-breakdown-cost">
                    <Amount value={floor.energyCost} kind="money" />
                  </span>
                </div>
                <p className="floor-breakdown-qty">
                  <Amount value={floor.energyKwh} /> kWh
                </p>
                <p className="floor-breakdown-split">
                  <span>
                    <Amount value={floor.energySubsidizedKwh} /> kWh subsidio
                  </span>
                  <span>
                    <Amount value={floor.energyStandardKwh} /> kWh estándar
                  </span>
                </p>
              </li>
              <li>
                <div className="floor-breakdown-main">
                  <span className="floor-breakdown-name">Alumbrado público</span>
                  <span className="floor-breakdown-cost">
                    <Amount value={floor.otherServicesApCost} kind="money" />
                  </span>
                </div>
              </li>
            </ul>
          </article>
        ))}
      </div>

      <details className="history-block">
        <summary>Ver precios usados y cuadre con el recibo</summary>
        <div className="stack-lg mt-4">
          <div className="ledger-wrap">
            <table className="ledger">
              <caption>Seis cifras y alumbrado público</caption>
              <tbody>
                <RateRow
                  label="Precio acueducto y alcantarillado subsidiado"
                  value={
                    <>
                      <Amount value={rates.waterSubsidizedUnitPrice} kind="money" /> / m³
                    </>
                  }
                />
                <RateRow
                  label="Precio acueducto y alcantarillado estándar"
                  value={
                    <>
                      <Amount value={rates.waterStandardUnitPrice} kind="money" /> / m³
                    </>
                  }
                />
                <RateRow
                  label="Otros de acueducto y alcantarillado (por piso)"
                  value={<Amount value={rates.waterOthersPerFloor[0] ?? 0} kind="money" />}
                />
                <RateRow
                  label="Precio energía subsidiada"
                  value={
                    <>
                      <Amount value={rates.energySubsidizedUnitPrice} kind="money" /> / kWh
                    </>
                  }
                />
                <RateRow
                  label="Precio energía estándar"
                  value={
                    <>
                      <Amount value={rates.energyStandardUnitPrice} kind="money" /> / kWh
                    </>
                  }
                />
                <RateRow
                  label="Otros de energía (por piso)"
                  value={<Amount value={rates.energyOthersPerFloor[0] ?? 0} kind="money" />}
                />
                <RateRow
                  label="Otros servicios + AP (por piso)"
                  value={<Amount value={rates.otherServicesApPerFloor[0] ?? 0} kind="money" />}
                />
              </tbody>
            </table>
          </div>
          <div className="ledger-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Bloque</th>
                  <th>Suma de pisos</th>
                  <th>Recibo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Acueducto y alcantarillado</td>
                  <td>
                    <Amount value={totals.waterAndSewer} kind="money" />
                  </td>
                  <td>
                    <Amount value={totals.billWaterAndSewer} kind="money" />
                  </td>
                </tr>
                <tr>
                  <td>Energía</td>
                  <td>
                    <Amount value={totals.energy} kind="money" />
                  </td>
                  <td>
                    <Amount value={totals.billEnergy} kind="money" />
                  </td>
                </tr>
                <tr>
                  <td>Otros servicios + AP</td>
                  <td>
                    <Amount value={totals.otherServicesAp} kind="money" />
                  </td>
                  <td>
                    <Amount value={totals.billOtherServicesAp} kind="money" />
                  </td>
                </tr>
                <tr className="is-total">
                  <td>Total</td>
                  <td>
                    <Amount value={totals.payable} kind="money" />
                  </td>
                  <td>
                    <Amount value={totals.billPayable} kind="money" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </WorkPanel>
  );
}

function RateRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <th className="plain">{label}</th>
      <td>{value}</td>
    </tr>
  );
}
