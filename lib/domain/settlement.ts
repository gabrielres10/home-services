import type { BillChargeValueMap } from "./bill-charges";
import { billChargeLookup } from "./bill-charges";
import type { CatalogFloor } from "./period-consumption";
import type { ValidationIssue } from "./types";

export const ENERGY_SUBSIDY_BLOCK_KWH = 173;
export const WATER_SUBSIDY_BLOCK_M3 = 16;

export type FloorConsumption = {
  floorId: string;
  floorCode: string;
  floorName: string;
  sortOrder: number;
  energyKwh: number;
  waterM3: number;
};

export type SettlementBillMoney = {
  energyBasic: number;
  energyExcess: number;
  energyLateInterest: number;
  energyOtherCharges: number;
  energyRounding: number;
  waterBasicCharge: number;
  waterBasicConsumption: number;
  waterExcess: number;
  waterVitalMinimum: number;
  waterLateInterest: number;
  waterRounding: number;
  sewerBasicCharge: number;
  sewerBasicConsumption: number;
  sewerExcess: number;
  sewerLateInterest: number;
  sewerRounding: number;
  otherServicesAp: number;
};

export type SettlementInput = {
  periodId: string;
  periodLabel: string;
  floors: FloorConsumption[];
  bill: SettlementBillMoney;
};

export type SubsidyAllocation = {
  subsidized: number[];
  standard: number[];
};

export type SettlementRates = {
  energySubsidizedUnitPrice: number;
  energyStandardUnitPrice: number;
  energyOthersPerFloor: number[];
  waterSubsidizedUnitPrice: number;
  waterStandardUnitPrice: number;
  waterOthersPerFloor: number[];
  otherServicesApPerFloor: number[];
  energyBlockKwh: number;
  waterBlockM3: number;
  energyCapPerFloor: number;
  waterCapPerFloor: number;
  floorCount: number;
};

export type FloorSettlement = {
  floorId: string;
  floorCode: string;
  floorName: string;
  energyKwh: number;
  energySubsidizedKwh: number;
  energyStandardKwh: number;
  energyCost: number;
  waterM3: number;
  waterSubsidizedM3: number;
  waterStandardM3: number;
  waterCost: number;
  otherServicesApCost: number;
  total: number;
};

export type SettlementTotals = {
  energy: number;
  waterAndSewer: number;
  otherServicesAp: number;
  payable: number;
  billEnergy: number;
  billWaterAndSewer: number;
  billOtherServicesAp: number;
  billPayable: number;
};

export type SettlementResult = {
  periodId: string;
  periodLabel: string;
  rates: SettlementRates;
  floors: FloorSettlement[];
  totals: SettlementTotals;
  notes: ValidationIssue[];
  adjustments: string[];
};

export type SettlementResolution = {
  result: SettlementResult | null;
  unavailableMessage: string | null;
};

export function unitPrice(money: number, quantity: number): number {
  if (quantity <= 0) {
    return 0;
  }
  return money / quantity;
}

export function splitEvenly(amount: number, n: number): number[] {
  if (n <= 0) {
    return [];
  }
  const share = amount / n;
  return Array.from({ length: n }, (_, index) =>
    index === n - 1 ? amount - share * (n - 1) : share,
  );
}

export function allocateSubsidyBlocks(
  consumptions: number[],
  householdBlock: number,
): SubsidyAllocation {
  const n = consumptions.length;
  const sanitized = consumptions.map((value) => Math.max(0, value));
  if (n === 0) {
    return { subsidized: [], standard: [] };
  }

  const house = sanitized.reduce((sum, value) => sum + value, 0);
  if (house <= householdBlock) {
    return {
      subsidized: sanitized,
      standard: sanitized.map(() => 0),
    };
  }

  const cap = householdBlock / n;
  const subsidized = sanitized.map((value) => Math.min(value, cap));
  const standard = sanitized.map((value, index) =>
    Math.max(0, value - subsidized[index]!),
  );

  const unused = householdBlock - subsidized.reduce((sum, value) => sum + value, 0);
  const excessTotal = standard.reduce((sum, value) => sum + value, 0);
  if (unused > 0 && excessTotal > 0) {
    for (let index = 0; index < n; index += 1) {
      const extra = unused * (standard[index]! / excessTotal);
      subsidized[index] = subsidized[index]! + extra;
      standard[index] = Math.max(0, standard[index]! - extra);
    }
  }

  return { subsidized, standard };
}

export function subsidyWasReallocated(
  consumptions: number[],
  householdBlock: number,
  allocation: SubsidyAllocation,
): boolean {
  const n = consumptions.length;
  if (n === 0) {
    return false;
  }
  const house = consumptions.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (house <= householdBlock) {
    return false;
  }
  const cap = householdBlock / n;
  return consumptions.some((value, index) => {
    const naive = Math.min(Math.max(0, value), cap);
    return Math.abs(naive - (allocation.subsidized[index] ?? 0)) > 1e-6;
  });
}

function requireCharge(value: number | null, label: string): number {
  if (value === null) {
    throw new Error(`Falta el importe ${label}.`);
  }
  return value;
}

export function settlementBillFromCharges(
  charges: BillChargeValueMap,
  otherServicesAp: number | null,
): SettlementBillMoney | null {
  if (otherServicesAp === null) {
    return null;
  }
  const fields: Array<[string, string, string]> = [
    ["energia", "consumo_basico_hasta_173", "energía / consumo básico"],
    ["energia", "consumo_mayor_al_basico", "energía / mayor al básico"],
    ["energia", "interes_mora", "energía / interés de mora"],
    ["energia", "otros_cobros", "energía / otros cobros"],
    ["energia", "ajuste_al_peso", "energía / ajuste al peso"],
    ["agua", "cargo_basico", "agua / cargo básico"],
    ["agua", "consumo_basico_hasta_16", "agua / consumo básico"],
    ["agua", "consumo_mayor_al_basico", "agua / mayor al básico"],
    ["agua", "minimo_vital", "agua / mínimo vital"],
    ["agua", "interes_mora", "agua / interés de mora"],
    ["agua", "ajuste_al_peso", "agua / ajuste al peso"],
    ["alcantarillado", "cargo_basico", "alcantarillado / cargo básico"],
    ["alcantarillado", "consumo_basico_hasta_16", "alcantarillado / consumo básico"],
    ["alcantarillado", "consumo_mayor_al_basico", "alcantarillado / mayor al básico"],
    ["alcantarillado", "interes_mora", "alcantarillado / interés de mora"],
    ["alcantarillado", "ajuste_al_peso", "alcantarillado / ajuste al peso"],
  ];
  if (fields.some(([service, code]) => billChargeLookup(charges, service, code) === null)) {
    return null;
  }
  return {
    energyBasic: requireCharge(
      billChargeLookup(charges, "energia", "consumo_basico_hasta_173"),
      "energía / consumo básico",
    ),
    energyExcess: requireCharge(
      billChargeLookup(charges, "energia", "consumo_mayor_al_basico"),
      "energía / mayor al básico",
    ),
    energyLateInterest: requireCharge(
      billChargeLookup(charges, "energia", "interes_mora"),
      "energía / interés de mora",
    ),
    energyOtherCharges: requireCharge(
      billChargeLookup(charges, "energia", "otros_cobros"),
      "energía / otros cobros",
    ),
    energyRounding: requireCharge(
      billChargeLookup(charges, "energia", "ajuste_al_peso"),
      "energía / ajuste al peso",
    ),
    waterBasicCharge: requireCharge(
      billChargeLookup(charges, "agua", "cargo_basico"),
      "agua / cargo básico",
    ),
    waterBasicConsumption: requireCharge(
      billChargeLookup(charges, "agua", "consumo_basico_hasta_16"),
      "agua / consumo básico",
    ),
    waterExcess: requireCharge(
      billChargeLookup(charges, "agua", "consumo_mayor_al_basico"),
      "agua / mayor al básico",
    ),
    waterVitalMinimum: requireCharge(
      billChargeLookup(charges, "agua", "minimo_vital"),
      "agua / mínimo vital",
    ),
    waterLateInterest: requireCharge(
      billChargeLookup(charges, "agua", "interes_mora"),
      "agua / interés de mora",
    ),
    waterRounding: requireCharge(
      billChargeLookup(charges, "agua", "ajuste_al_peso"),
      "agua / ajuste al peso",
    ),
    sewerBasicCharge: requireCharge(
      billChargeLookup(charges, "alcantarillado", "cargo_basico"),
      "alcantarillado / cargo básico",
    ),
    sewerBasicConsumption: requireCharge(
      billChargeLookup(charges, "alcantarillado", "consumo_basico_hasta_16"),
      "alcantarillado / consumo básico",
    ),
    sewerExcess: requireCharge(
      billChargeLookup(charges, "alcantarillado", "consumo_mayor_al_basico"),
      "alcantarillado / mayor al básico",
    ),
    sewerLateInterest: requireCharge(
      billChargeLookup(charges, "alcantarillado", "interes_mora"),
      "alcantarillado / interés de mora",
    ),
    sewerRounding: requireCharge(
      billChargeLookup(charges, "alcantarillado", "ajuste_al_peso"),
      "alcantarillado / ajuste al peso",
    ),
    otherServicesAp,
  };
}

export function energyBillTotal(bill: SettlementBillMoney): number {
  return (
    bill.energyBasic +
    bill.energyExcess +
    bill.energyLateInterest +
    bill.energyOtherCharges +
    bill.energyRounding
  );
}

export function waterAndSewerBillTotal(bill: SettlementBillMoney): number {
  return (
    bill.waterBasicCharge +
    bill.waterBasicConsumption +
    bill.waterExcess +
    bill.waterVitalMinimum +
    bill.waterLateInterest +
    bill.waterRounding +
    bill.sewerBasicCharge +
    bill.sewerBasicConsumption +
    bill.sewerExcess +
    bill.sewerLateInterest +
    bill.sewerRounding
  );
}

function billedBlockQuantity(houseConsumption: number, blockSize: number): {
  subsidized: number;
  standard: number;
} {
  const subsidized = Math.min(Math.max(houseConsumption, 0), blockSize);
  const standard = Math.max(0, houseConsumption - blockSize);
  return { subsidized, standard };
}

export function calculateSettlement(input: SettlementInput): SettlementResult {
  const floors = [...input.floors].sort((a, b) => a.sortOrder - b.sortOrder);
  const n = floors.length;
  if (n === 0) {
    throw new Error("No hay pisos para liquidar.");
  }

  const energyKwh = floors.map((floor) => floor.energyKwh);
  const waterM3 = floors.map((floor) => floor.waterM3);
  const houseEnergy = energyKwh.reduce((sum, value) => sum + value, 0);
  const houseWater = waterM3.reduce((sum, value) => sum + value, 0);

  const energyOnBill = billedBlockQuantity(houseEnergy, ENERGY_SUBSIDY_BLOCK_KWH);
  const waterOnBill = billedBlockQuantity(houseWater, WATER_SUBSIDY_BLOCK_M3);

  const energySubsidizedUnitPrice = unitPrice(input.bill.energyBasic, energyOnBill.subsidized);
  const energyStandardUnitPrice = unitPrice(input.bill.energyExcess, energyOnBill.standard);
  const waterSubsidizedUnitPrice = unitPrice(
    input.bill.waterBasicConsumption + input.bill.sewerBasicConsumption,
    waterOnBill.subsidized,
  );
  const waterStandardUnitPrice = unitPrice(
    input.bill.waterExcess + input.bill.sewerExcess,
    waterOnBill.standard,
  );

  const energyOthersHouse =
    input.bill.energyLateInterest +
    input.bill.energyOtherCharges +
    input.bill.energyRounding;
  const waterOthersHouse =
    input.bill.waterBasicCharge +
    input.bill.sewerBasicCharge +
    input.bill.waterLateInterest +
    input.bill.sewerLateInterest +
    input.bill.waterRounding +
    input.bill.sewerRounding +
    input.bill.waterVitalMinimum;

  const energyOthersPerFloor = splitEvenly(energyOthersHouse, n);
  const waterOthersPerFloor = splitEvenly(waterOthersHouse, n);
  const otherServicesApPerFloor = splitEvenly(input.bill.otherServicesAp, n);

  const energyBlocks = allocateSubsidyBlocks(energyKwh, ENERGY_SUBSIDY_BLOCK_KWH);
  const waterBlocks = allocateSubsidyBlocks(waterM3, WATER_SUBSIDY_BLOCK_M3);

  const floorSettlements: FloorSettlement[] = floors.map((floor, index) => {
    const energySubsidizedKwh = energyBlocks.subsidized[index] ?? 0;
    const energyStandardKwh = energyBlocks.standard[index] ?? 0;
    const waterSubsidizedM3 = waterBlocks.subsidized[index] ?? 0;
    const waterStandardM3 = waterBlocks.standard[index] ?? 0;
    const energyOthers = energyOthersPerFloor[index] ?? 0;
    const waterOthers = waterOthersPerFloor[index] ?? 0;
    const otherServicesApCost = otherServicesApPerFloor[index] ?? 0;
    const energyCost =
      energySubsidizedKwh * energySubsidizedUnitPrice +
      energyStandardKwh * energyStandardUnitPrice +
      energyOthers;
    const waterCost =
      waterSubsidizedM3 * waterSubsidizedUnitPrice +
      waterStandardM3 * waterStandardUnitPrice +
      waterOthers;
    return {
      floorId: floor.floorId,
      floorCode: floor.floorCode,
      floorName: floor.floorName,
      energyKwh: floor.energyKwh,
      energySubsidizedKwh,
      energyStandardKwh,
      energyCost,
      waterM3: floor.waterM3,
      waterSubsidizedM3,
      waterStandardM3,
      waterCost,
      otherServicesApCost,
      total: energyCost + waterCost + otherServicesApCost,
    };
  });

  const allocatedEnergy = floorSettlements.reduce((sum, floor) => sum + floor.energyCost, 0);
  const allocatedWater = floorSettlements.reduce((sum, floor) => sum + floor.waterCost, 0);
  const allocatedAp = floorSettlements.reduce(
    (sum, floor) => sum + floor.otherServicesApCost,
    0,
  );
  const billEnergy = energyBillTotal(input.bill);
  const billWaterAndSewer = waterAndSewerBillTotal(input.bill);
  const notes: ValidationIssue[] = [];
  const adjustments: string[] = [];
  if (subsidyWasReallocated(energyKwh, ENERGY_SUBSIDY_BLOCK_KWH, energyBlocks)) {
    adjustments.push(
      "Un piso no usó todo su cupo de energía subsidiada. Ese cupo se asignó a quien sí se pasó, para cubrir el recibo completo.",
    );
  }
  if (subsidyWasReallocated(waterM3, WATER_SUBSIDY_BLOCK_M3, waterBlocks)) {
    adjustments.push(
      "Un piso no usó todo su cupo de acueducto subsidiado. Ese cupo se asignó a quien sí se pasó, para cubrir el recibo completo.",
    );
  }
  if (Math.abs(allocatedEnergy - billEnergy) > 0.05) {
    notes.push({
      code: "settlement.energy_remainder",
      severity: "warning",
      message:
        "La suma de energía por piso no coincide con el total de energía del recibo. Revisa consumos o importes.",
    });
  }
  if (Math.abs(allocatedWater - billWaterAndSewer) > 0.05) {
    notes.push({
      code: "settlement.water_remainder",
      severity: "warning",
      message:
        "La suma de acueducto y alcantarillado por piso no coincide con el recibo. Revisa consumos o importes.",
    });
  }

  return {
    periodId: input.periodId,
    periodLabel: input.periodLabel,
    rates: {
      energySubsidizedUnitPrice,
      energyStandardUnitPrice,
      energyOthersPerFloor,
      waterSubsidizedUnitPrice,
      waterStandardUnitPrice,
      waterOthersPerFloor,
      otherServicesApPerFloor,
      energyBlockKwh: ENERGY_SUBSIDY_BLOCK_KWH,
      waterBlockM3: WATER_SUBSIDY_BLOCK_M3,
      energyCapPerFloor: ENERGY_SUBSIDY_BLOCK_KWH / n,
      waterCapPerFloor: WATER_SUBSIDY_BLOCK_M3 / n,
      floorCount: n,
    },
    floors: floorSettlements,
    totals: {
      energy: allocatedEnergy,
      waterAndSewer: allocatedWater,
      otherServicesAp: allocatedAp,
      payable: allocatedEnergy + allocatedWater + allocatedAp,
      billEnergy,
      billWaterAndSewer,
      billOtherServicesAp: input.bill.otherServicesAp,
      billPayable: billEnergy + billWaterAndSewer + input.bill.otherServicesAp,
    },
    notes,
    adjustments,
  };
}

export function floorsFromCatalogAndLines(
  floors: CatalogFloor[],
  lines: Array<{
    floorId: string;
    serviceCode: string;
    consumption: number | null;
    calculable: boolean;
  }>,
): FloorConsumption[] | null {
  const result: FloorConsumption[] = [];
  for (const floor of [...floors].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const energy = lines.find(
      (line) => line.floorId === floor.id && line.serviceCode === "energia",
    );
    const water = lines.find(
      (line) => line.floorId === floor.id && line.serviceCode === "agua",
    );
    if (
      !energy ||
      !water ||
      !energy.calculable ||
      !water.calculable ||
      energy.consumption === null ||
      water.consumption === null
    ) {
      return null;
    }
    result.push({
      floorId: floor.id,
      floorCode: floor.code,
      floorName: floor.name,
      sortOrder: floor.sortOrder,
      energyKwh: energy.consumption,
      waterM3: water.consumption,
    });
  }
  return result;
}

export function resolveSettlement(input: {
  periodId: string;
  periodLabel: string;
  isOpeningPeriod: boolean;
  floors: CatalogFloor[];
  lines: Array<{
    floorId: string;
    serviceCode: string;
    consumption: number | null;
    calculable: boolean;
  }>;
  charges: BillChargeValueMap;
  otherServicesAp: number | null;
}): SettlementResolution {
  if (input.isOpeningPeriod) {
    return {
      result: null,
      unavailableMessage:
        "El período inicial no se liquida: sus lecturas quedan como referencia del siguiente período.",
    };
  }

  const bill = settlementBillFromCharges(input.charges, input.otherServicesAp);
  if (!bill) {
    return {
      result: null,
      unavailableMessage:
        "Faltan importes en pesos del recibo o el subtotal de otros servicios + AP.",
    };
  }

  const floors = floorsFromCatalogAndLines(input.floors, input.lines);
  if (!floors) {
    return {
      result: null,
      unavailableMessage:
        "Aún no se pueden calcular todos los consumos por piso. Faltan lecturas aprobadas o el piso sin contador no cuadra.",
    };
  }

  return {
    result: calculateSettlement({
      periodId: input.periodId,
      periodLabel: input.periodLabel,
      floors,
      bill,
    }),
    unavailableMessage: null,
  };
}

export interface CalculationEngine {
  calculate(input: SettlementInput): SettlementResult;
}

export class HouseholdSettlementEngine implements CalculationEngine {
  calculate(input: SettlementInput): SettlementResult {
    return calculateSettlement(input);
  }
}

export const calculationEngine: CalculationEngine = new HouseholdSettlementEngine();
