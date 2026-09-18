export type SettlementConsumption = {
  floorCode: string;
  floorName: string;
  serviceCode: string;
  serviceName: string;
  consumption: number;
};

export type SettlementInput = {
  periodId: string;
  periodLabel: string;
  consumptions: SettlementConsumption[];
};

export type SettlementLine = {
  floorCode: string;
  floorName: string;
  amount: number;
  details: string;
};

export type SettlementResult = {
  periodId: string;
  lines: SettlementLine[];
};

export interface CalculationEngine {
  calculate(input: SettlementInput): SettlementResult;
}

export class UnimplementedCalculationEngine implements CalculationEngine {
  calculate(input: SettlementInput): SettlementResult {
    void input;
    throw new Error(
      "Las fórmulas de liquidación todavía no están definidas. Este módulo se incorporará cuando se especifiquen las reglas actuales de Excel.",
    );
  }
}

export const calculationEngine: CalculationEngine =
  new UnimplementedCalculationEngine();
