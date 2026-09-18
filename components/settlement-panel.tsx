import { IssueList } from "@/components/issue-list";
import { WorkPanel } from "@/components/ui";
import type { SettlementResult } from "@/lib/domain/settlement";
import { formatMoney, formatNumber } from "@/lib/format";

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
              <div>
                <p className="kicker">Piso</p>
                <h3>{floor.floorName}</h3>
              </div>
              <p className="floor-total">{formatMoney(floor.total)}</p>
            </header>
            <dl>
              <div>
                <dt>Energía · {formatNumber(floor.energyKwh)} kWh</dt>
                <dd>{formatMoney(floor.energyCost)}</dd>
                <span className="split">
                  {formatNumber(floor.energySubsidizedKwh)} kWh subsidio ·{" "}
                  {formatNumber(floor.energyStandardKwh)} kWh estándar
                </span>
              </div>
              <div>
                <dt>Agua · {formatNumber(floor.waterM3)} m³</dt>
                <dd>{formatMoney(floor.waterCost)}</dd>
                <span className="split">
                  {formatNumber(floor.waterSubsidizedM3)} m³ subsidio ·{" "}
                  {formatNumber(floor.waterStandardM3)} m³ estándar
                </span>
              </div>
              <div>
                <dt>Alumbrado público (AP)</dt>
                <dd>{formatMoney(floor.otherServicesApCost)}</dd>
              </div>
            </dl>
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
                  label="Precio energía subsidiada"
                  value={`${formatMoney(rates.energySubsidizedUnitPrice)} / kWh`}
                />
                <RateRow
                  label="Precio energía estándar"
                  value={`${formatMoney(rates.energyStandardUnitPrice)} / kWh`}
                />
                <RateRow
                  label="Otros de energía (por piso)"
                  value={formatMoney(rates.energyOthersPerFloor[0] ?? 0)}
                />
                <RateRow
                  label="Precio acueducto y alcantarillado subsidiado"
                  value={`${formatMoney(rates.waterSubsidizedUnitPrice)} / m³`}
                />
                <RateRow
                  label="Precio acueducto y alcantarillado estándar"
                  value={`${formatMoney(rates.waterStandardUnitPrice)} / m³`}
                />
                <RateRow
                  label="Otros de acueducto y alcantarillado (por piso)"
                  value={formatMoney(rates.waterOthersPerFloor[0] ?? 0)}
                />
                <RateRow
                  label="Otros servicios + AP (por piso)"
                  value={formatMoney(rates.otherServicesApPerFloor[0] ?? 0)}
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
                  <td>Energía</td>
                  <td>{formatMoney(totals.energy)}</td>
                  <td>{formatMoney(totals.billEnergy)}</td>
                </tr>
                <tr>
                  <td>Acueducto y alcantarillado</td>
                  <td>{formatMoney(totals.waterAndSewer)}</td>
                  <td>{formatMoney(totals.billWaterAndSewer)}</td>
                </tr>
                <tr>
                  <td>Otros servicios + AP</td>
                  <td>{formatMoney(totals.otherServicesAp)}</td>
                  <td>{formatMoney(totals.billOtherServicesAp)}</td>
                </tr>
                <tr className="is-total">
                  <td>Total</td>
                  <td>{formatMoney(totals.payable)}</td>
                  <td>{formatMoney(totals.billPayable)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </WorkPanel>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th className="plain">{label}</th>
      <td>{value}</td>
    </tr>
  );
}
