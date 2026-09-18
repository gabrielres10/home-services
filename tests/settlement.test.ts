import { describe, expect, it } from "vitest";
import { extractBillDraft, ManualBillExtractor } from "@/lib/billing/extractor";
import {
  ENERGY_SUBSIDY_BLOCK_KWH,
  WATER_SUBSIDY_BLOCK_M3,
  allocateSubsidyBlocks,
  calculateSettlement,
  energyBillTotal,
  resolveSettlement,
  splitEvenly,
  subsidyWasReallocated,
  unitPrice,
  type FloorConsumption,
  type SettlementBillMoney,
} from "@/lib/domain/settlement";

const exampleBill: SettlementBillMoney = {
  energyBasic: 86500,
  energyExcess: 181600,
  energyLateInterest: 9000,
  energyOtherCharges: 3000,
  energyRounding: -300,
  waterBasicCharge: 12000,
  waterBasicConsumption: 16000,
  waterExcess: 48000,
  waterVitalMinimum: -6000,
  waterLateInterest: 0,
  waterRounding: 100,
  sewerBasicCharge: 8000,
  sewerBasicConsumption: 14000,
  sewerExcess: 36000,
  sewerLateInterest: 0,
  sewerRounding: -50,
  otherServicesAp: 45000,
};

function floors(energy: number[], water: number[]): FloorConsumption[] {
  return energy.map((kwh, index) => ({
    floorId: `f${index + 1}`,
    floorCode: `piso-${index + 1}`,
    floorName: `Piso ${index + 1}`,
    sortOrder: index + 1,
    energyKwh: kwh,
    waterM3: water[index] ?? 0,
  }));
}

describe("unitPrice", () => {
  it("no divide entre cero ni entre cantidades negativas", () => {
    expect(unitPrice(181600, 0)).toBe(0);
    expect(unitPrice(181600, -10)).toBe(0);
    expect(unitPrice(86500, 173)).toBe(500);
  });
});

describe("splitEvenly", () => {
  it("reparte entre n pisos y el último absorbe el residuo", () => {
    expect(splitEvenly(11700, 3)).toEqual([3900, 3900, 3900]);
    const parts = splitEvenly(10, 3);
    expect(parts[0]).toBeCloseTo(10 / 3);
    expect(parts[1]).toBeCloseTo(10 / 3);
    expect(parts[2]).toBeCloseTo(10 - (10 / 3) * 2);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(10);
  });
});

describe("allocateSubsidyBlocks", () => {
  it("usa max(0) y no genera excedente negativo", () => {
    const result = allocateSubsidyBlocks([20, 40, 40], ENERGY_SUBSIDY_BLOCK_KWH);
    expect(result.standard.every((value) => value >= 0)).toBe(true);
    expect(result.subsidized[0]).toBe(20);
    expect(result.standard[0]).toBe(0);
  });

  it("si la casa no supera el bloque, todo el consumo es subsidiado", () => {
    const result = allocateSubsidyBlocks([40, 40, 40], ENERGY_SUBSIDY_BLOCK_KWH);
    expect(result.subsidized).toEqual([40, 40, 40]);
    expect(result.standard).toEqual([0, 0, 0]);
  });

  it("si todos superan el cupo, cada uno usa bloque/n y el resto es estándar", () => {
    const result = allocateSubsidyBlocks([80, 150, 170], ENERGY_SUBSIDY_BLOCK_KWH);
    const cap = ENERGY_SUBSIDY_BLOCK_KWH / 3;
    expect(result.subsidized[0]).toBeCloseTo(cap);
    expect(result.standard[0]).toBeCloseTo(80 - cap);
    expect(result.subsidized.reduce((sum, value) => sum + value, 0)).toBeCloseTo(173);
    expect(result.standard.reduce((sum, value) => sum + value, 0)).toBeCloseTo(227);
  });

  it("reasigna el cupo no usado a quien sí se pasó, para cobrar todo el recibo", () => {
    const consumptions = [20, 190, 190];
    const result = allocateSubsidyBlocks(consumptions, ENERGY_SUBSIDY_BLOCK_KWH);
    expect(result.subsidized[0]).toBe(20);
    expect(result.standard[0]).toBe(0);
    expect(result.subsidized.reduce((sum, value) => sum + value, 0)).toBeCloseTo(173);
    expect(result.standard.reduce((sum, value) => sum + value, 0)).toBeCloseTo(227);
    expect(result.subsidized[1]).toBeCloseTo(result.subsidized[2]!);
    expect(subsidyWasReallocated(consumptions, ENERGY_SUBSIDY_BLOCK_KWH, result)).toBe(true);
  });
});

describe("calculateSettlement", () => {
  it("reproduce el ejemplo de energía del procedimiento", () => {
    const result = calculateSettlement({
      periodId: "p1",
      periodLabel: "Ejemplo",
      floors: floors([80, 150, 170], [10, 15, 15]),
      bill: exampleBill,
    });

    expect(result.rates.energySubsidizedUnitPrice).toBe(500);
    expect(result.rates.energyStandardUnitPrice).toBe(800);
    expect(result.rates.energyOthersPerFloor[0]).toBe(3900);
    expect(result.floors[0]?.energyCost).toBeCloseTo(50600);
    expect(result.floors[1]?.energyCost).toBeCloseTo(106600);
    expect(result.floors[2]?.energyCost).toBeCloseTo(122600);
    expect(result.totals.energy).toBeCloseTo(279800);
    expect(result.totals.billEnergy).toBe(279800);
  });

  it("parte AP entre los pisos sin mirar consumo", () => {
    const result = calculateSettlement({
      periodId: "p1",
      periodLabel: "Ejemplo",
      floors: floors([80, 150, 170], [10, 15, 15]),
      bill: exampleBill,
    });
    expect(result.floors.map((floor) => floor.otherServicesApCost)).toEqual([
      15000, 15000, 15000,
    ]);
    expect(result.totals.otherServicesAp).toBe(45000);
  });

  it("junta agua y alcantarillado en un solo precio por m³", () => {
    const result = calculateSettlement({
      periodId: "p1",
      periodLabel: "Ejemplo",
      floors: floors([80, 150, 170], [10, 15, 15]),
      bill: exampleBill,
    });
    const houseWater = 40;
    expect(result.rates.waterSubsidizedUnitPrice).toBeCloseTo((16000 + 14000) / 16);
    expect(result.rates.waterStandardUnitPrice).toBeCloseTo(
      (48000 + 36000) / (houseWater - WATER_SUBSIDY_BLOCK_M3),
    );
    expect(result.totals.waterAndSewer).toBeCloseTo(result.totals.billWaterAndSewer);
  });

  it("si la casa no supera 173 kWh, no divide entre cero y cobra todo a tarifa subsidiada", () => {
    const result = calculateSettlement({
      periodId: "p1",
      periodLabel: "Bajo consumo",
      floors: floors([40, 40, 40], [4, 4, 4]),
      bill: {
        ...exampleBill,
        energyExcess: 0,
        waterExcess: 0,
        sewerExcess: 0,
      },
    });
    expect(result.rates.energyStandardUnitPrice).toBe(0);
    expect(result.rates.waterStandardUnitPrice).toBe(0);
    expect(result.floors.every((floor) => floor.energyStandardKwh === 0)).toBe(true);
    expect(result.totals.energy).toBeCloseTo(result.totals.billEnergy);
  });

  it("el total de cada piso es energía + agua/alcantarillado + AP", () => {
    const result = calculateSettlement({
      periodId: "p1",
      periodLabel: "Ejemplo",
      floors: floors([80, 150, 170], [10, 15, 15]),
      bill: exampleBill,
    });
    for (const floor of result.floors) {
      expect(floor.total).toBeCloseTo(
        floor.energyCost + floor.waterCost + floor.otherServicesApCost,
      );
    }
    expect(result.totals.payable).toBeCloseTo(result.totals.billPayable);
  });

  it("si un piso no llega al tope, no cobra tarifa estándar negativa y reasigna el cupo", () => {
    const result = calculateSettlement({
      periodId: "p1",
      periodLabel: "Cupo sobrante",
      floors: floors([20, 190, 190], [10, 15, 15]),
      bill: exampleBill,
    });
    expect(result.floors[0]?.energyStandardKwh).toBe(0);
    expect(result.floors[0]?.energyCost).toBeGreaterThan(0);
    expect(result.adjustments.length).toBeGreaterThan(0);
    expect(result.totals.energy).toBeCloseTo(energyBillTotal(exampleBill));
    expect(result.totals.payable).toBeCloseTo(result.totals.billPayable);
  });
});

describe("resolveSettlement", () => {
  it("no liquida el período inicial", () => {
    const resolution = resolveSettlement({
      periodId: "p1",
      periodLabel: "Inicial",
      isOpeningPeriod: true,
      floors: [],
      lines: [],
      charges: {
        energia: {},
        agua: {},
        alcantarillado: {},
      },
      otherServicesAp: 0,
    });
    expect(resolution.result).toBeNull();
    expect(resolution.unavailableMessage).toMatch(/período inicial/i);
  });
});

describe("BillExtractor", () => {
  it("en v1 usa la captura manual y deja el PDF para un extractor futuro", async () => {
    const draft = await extractBillDraft(
      null,
      {
        totals: [{ serviceCode: "agua", totalConsumption: 100 }],
        charges: [{ serviceCode: "agua", chargeCode: "cargo_basico", amount: 15000 }],
        otherServicesApSubtotal: 42000,
      },
      new ManualBillExtractor(),
    );
    expect(draft.source).toBe("manual");
    expect(draft.totals[0]?.totalConsumption).toBe(100);
    expect(draft.charges[0]?.amount).toBe(15000);
    expect(draft.otherServicesApSubtotal).toBe(42000);
  });
});
