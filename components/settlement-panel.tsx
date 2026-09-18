import { IssueList } from "@/components/issue-list";
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
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Liquidación</h2>
        <p className="rounded border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
          {unavailableMessage ??
            (isOpeningPeriod
              ? "El período inicial no se liquida."
              : "La liquidación se calcula cuando el recibo y los consumos estén completos.")}
        </p>
      </section>
    );
  }

  const { rates, floors, totals } = settlement;

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Liquidación</h2>
        <p className="text-sm text-stone-600">
          El recibo de la casa se reparte entre {formatNumber(rates.floorCount)} pisos.
          Cada piso tiene derecho a {formatNumber(rates.energyCapPerFloor)} kWh y{" "}
          {formatNumber(rates.waterCapPerFloor)} m³ a tarifa subsidiada. Lo que se pase
          de ese cupo se cobra a tarifa plena. Mora, cargos fijos, mínimo vital, ajuste
          al peso y alumbrado público se parten por igual.
        </p>
      </div>

      {settlement.adjustments.length > 0 ? (
        <ul className="space-y-1">
          {settlement.adjustments.map((message) => (
            <li
              key={message}
              className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950"
            >
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      <IssueList issues={settlement.notes} />

      <div className="overflow-x-auto rounded border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="bg-stone-50 px-3 py-2 text-left font-medium text-stone-800">
            Seis cifras y alumbrado público
          </caption>
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

      <div className="overflow-x-auto rounded border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-3 py-2">Piso</th>
              <th className="px-3 py-2">Energía</th>
              <th className="px-3 py-2">kWh subsidio</th>
              <th className="px-3 py-2">kWh estándar</th>
              <th className="px-3 py-2">Costo energía</th>
              <th className="px-3 py-2">Agua</th>
              <th className="px-3 py-2">m³ subsidio</th>
              <th className="px-3 py-2">m³ estándar</th>
              <th className="px-3 py-2">Costo agua</th>
              <th className="px-3 py-2">AP</th>
              <th className="px-3 py-2">Total a pagar</th>
            </tr>
          </thead>
          <tbody>
            {floors.map((floor) => (
              <tr key={floor.floorId} className="border-t border-stone-100">
                <td className="px-3 py-2 font-medium">{floor.floorName}</td>
                <td className="px-3 py-2">{formatNumber(floor.energyKwh)} kWh</td>
                <td className="px-3 py-2">{formatNumber(floor.energySubsidizedKwh)}</td>
                <td className="px-3 py-2">{formatNumber(floor.energyStandardKwh)}</td>
                <td className="px-3 py-2">{formatMoney(floor.energyCost)}</td>
                <td className="px-3 py-2">{formatNumber(floor.waterM3)} m³</td>
                <td className="px-3 py-2">{formatNumber(floor.waterSubsidizedM3)}</td>
                <td className="px-3 py-2">{formatNumber(floor.waterStandardM3)}</td>
                <td className="px-3 py-2">{formatMoney(floor.waterCost)}</td>
                <td className="px-3 py-2">{formatMoney(floor.otherServicesApCost)}</td>
                <td className="px-3 py-2 font-medium">{formatMoney(floor.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-3 py-2">Bloque</th>
              <th className="px-3 py-2">Suma de pisos</th>
              <th className="px-3 py-2">Recibo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-stone-100">
              <td className="px-3 py-2">Energía</td>
              <td className="px-3 py-2">{formatMoney(totals.energy)}</td>
              <td className="px-3 py-2">{formatMoney(totals.billEnergy)}</td>
            </tr>
            <tr className="border-t border-stone-100">
              <td className="px-3 py-2">Acueducto y alcantarillado</td>
              <td className="px-3 py-2">{formatMoney(totals.waterAndSewer)}</td>
              <td className="px-3 py-2">{formatMoney(totals.billWaterAndSewer)}</td>
            </tr>
            <tr className="border-t border-stone-100">
              <td className="px-3 py-2">Otros servicios + AP</td>
              <td className="px-3 py-2">{formatMoney(totals.otherServicesAp)}</td>
              <td className="px-3 py-2">{formatMoney(totals.billOtherServicesAp)}</td>
            </tr>
            <tr className="border-t border-stone-100 font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2">{formatMoney(totals.payable)}</td>
              <td className="px-3 py-2">{formatMoney(totals.billPayable)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-stone-100 first:border-t-0">
      <th className="px-3 py-2 font-normal text-stone-700">{label}</th>
      <td className="px-3 py-2">{value}</td>
    </tr>
  );
}
