import type { ServiceCode } from "./types";
import { SERVICE_CODES } from "./types";

export type BillChargeField = {
  code: string;
  label: string;
};

export const BILL_CHARGE_CATALOG: Record<ServiceCode, readonly BillChargeField[]> = {
  energia: [
    { code: "consumo_basico_hasta_173", label: "Consumo básico hasta 173 kWh" },
    { code: "consumo_mayor_al_basico", label: "Consumo mayor al básico" },
    { code: "interes_mora", label: "Interés de mora" },
    { code: "otros_cobros", label: "Otros cobros" },
    { code: "ajuste_al_peso", label: "Ajuste al peso" },
  ],
  agua: [
    { code: "cargo_basico", label: "Cargo básico" },
    { code: "consumo_basico_hasta_16", label: "Consumo básico hasta 16" },
    { code: "consumo_mayor_al_basico", label: "Consumo mayor al básico" },
    { code: "minimo_vital", label: "Mínimo vital" },
    { code: "interes_mora", label: "Interés de mora" },
    { code: "ajuste_al_peso", label: "Ajuste al peso" },
  ],
  alcantarillado: [
    { code: "cargo_basico", label: "Cargo básico" },
    { code: "consumo_basico_hasta_16", label: "Consumo básico hasta 16" },
    { code: "consumo_mayor_al_basico", label: "Consumo mayor al básico 16" },
    { code: "interes_mora", label: "Interés de mora" },
    { code: "ajuste_al_peso", label: "Ajuste al peso" },
  ],
};

export type BillChargeValueMap = Record<ServiceCode, Record<string, number | null>>;

export function billChargeFieldName(serviceCode: string, chargeCode: string): string {
  return `charge_${serviceCode}_${chargeCode}`;
}

export function isServiceCode(value: string): value is ServiceCode {
  return (SERVICE_CODES as readonly string[]).includes(value);
}

export function billChargeFields(serviceCode: string): readonly BillChargeField[] {
  if (!isServiceCode(serviceCode)) {
    return [];
  }
  return BILL_CHARGE_CATALOG[serviceCode];
}

export function emptyBillChargeValues(): BillChargeValueMap {
  return {
    energia: Object.fromEntries(
      BILL_CHARGE_CATALOG.energia.map((field) => [field.code, null]),
    ),
    agua: Object.fromEntries(BILL_CHARGE_CATALOG.agua.map((field) => [field.code, null])),
    alcantarillado: Object.fromEntries(
      BILL_CHARGE_CATALOG.alcantarillado.map((field) => [field.code, null]),
    ),
  };
}

export function fillBillChargeValues(
  rows: Array<{ serviceCode: string; chargeCode: string; amount: number }>,
): BillChargeValueMap {
  const values = emptyBillChargeValues();
  for (const row of rows) {
    if (!isServiceCode(row.serviceCode)) {
      continue;
    }
    if (!(row.chargeCode in values[row.serviceCode])) {
      continue;
    }
    values[row.serviceCode][row.chargeCode] = row.amount;
  }
  return values;
}

export function billChargeValuesFromRows(
  services: Array<{ id: string; code: string }>,
  rows: Array<{ service_id: string; charge_code: string; amount: number }>,
): BillChargeValueMap {
  return fillBillChargeValues(
    rows.flatMap((row) => {
      const service = services.find((item) => item.id === row.service_id);
      if (!service) {
        return [];
      }
      return [
        {
          serviceCode: service.code,
          chargeCode: row.charge_code,
          amount: Number(row.amount),
        },
      ];
    }),
  );
}

export function billChargeLookup(
  values: BillChargeValueMap,
  serviceCode: string,
  chargeCode: string,
): number | null {
  if (!isServiceCode(serviceCode)) {
    return null;
  }
  return values[serviceCode][chargeCode] ?? null;
}
