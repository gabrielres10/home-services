import { describe, expect, it } from "vitest";
import {
  BILL_CHARGE_CATALOG,
  emptyBillChargeValues,
  fillBillChargeValues,
} from "@/lib/domain/bill-charges";
import {
  parseMoneyAmount,
  validateBill,
  validateBillCharges,
} from "@/lib/domain/validation";

function filledCharges(amount: number) {
  const values = emptyBillChargeValues();
  for (const [serviceCode, fields] of Object.entries(BILL_CHARGE_CATALOG)) {
    if (serviceCode !== "energia" && serviceCode !== "agua" && serviceCode !== "alcantarillado") {
      continue;
    }
    for (const field of fields) {
      values[serviceCode][field.code] = amount;
    }
  }
  return values;
}

describe("catálogo de importes del recibo", () => {
  it("pide los renglones de energía, agua y alcantarillado", () => {
    expect(BILL_CHARGE_CATALOG.energia.map((field) => field.label)).toEqual([
      "Consumo básico hasta 173 kWh",
      "Consumo mayor al básico",
      "Interés de mora",
      "Otros cobros",
      "Ajuste al peso",
    ]);
    expect(BILL_CHARGE_CATALOG.agua.map((field) => field.label)).toEqual([
      "Cargo básico",
      "Consumo básico hasta 16",
      "Consumo mayor al básico",
      "Mínimo vital",
      "Interés de mora",
      "Ajuste al peso",
    ]);
    expect(BILL_CHARGE_CATALOG.alcantarillado.map((field) => field.label)).toEqual([
      "Cargo básico",
      "Consumo básico hasta 16",
      "Consumo mayor al básico 16",
      "Interés de mora",
      "Ajuste al peso",
    ]);
  });
});

describe("parseMoneyAmount", () => {
  it("acepta cero y valores negativos", () => {
    expect(parseMoneyAmount("0")).toEqual({ ok: true, value: 0 });
    expect(parseMoneyAmount("-1,5")).toEqual({ ok: true, value: -1.5 });
  });

  it("rechaza vacío o texto", () => {
    const empty = parseMoneyAmount("");
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.issue.code).toBe("bill.charge_empty");
    }
    const spaces = parseMoneyAmount(" ");
    expect(spaces.ok).toBe(false);
    if (!spaces.ok) {
      expect(spaces.issue.code).toBe("bill.charge_not_numeric");
    }
    const invalid = parseMoneyAmount("12a");
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issue.code).toBe("bill.charge_not_numeric");
    }
  });
});

describe("validateBillCharges", () => {
  it("exige todos los importes", () => {
    const issues = validateBillCharges(emptyBillChargeValues());
    expect(issues.filter((issue) => issue.code === "bill.charge_missing")).toHaveLength(16);
  });

  it("acepta cero en todos los renglones", () => {
    expect(validateBillCharges(filledCharges(0))).toEqual([]);
  });

  it("conserva el mínimo vital negativo", () => {
    const values = fillBillChargeValues([
      { serviceCode: "agua", chargeCode: "minimo_vital", amount: -12000 },
    ]);
    expect(values.agua.minimo_vital).toBe(-12000);
  });
});

describe("validateBill", () => {
  it("el recibo no está completo si faltan importes", () => {
    const issues = validateBill({
      energy: 100,
      water: 50,
      sewer: 50,
      hasPdf: true,
      charges: emptyBillChargeValues(),
      otherServicesApSubtotal: 1000,
    });
    expect(issues.some((issue) => issue.code === "bill.charge_missing")).toBe(true);
  });

  it("queda completo con consumos e importes", () => {
    const issues = validateBill({
      energy: 100,
      water: 50,
      sewer: 50,
      hasPdf: true,
      charges: filledCharges(1000),
      otherServicesApSubtotal: 0,
    });
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("exige el subtotal de otros servicios + AP", () => {
    const issues = validateBill({
      energy: 100,
      water: 50,
      sewer: 50,
      hasPdf: true,
      charges: filledCharges(1000),
      otherServicesApSubtotal: null,
    });
    expect(issues.some((issue) => issue.code === "bill.other_services_ap_missing")).toBe(
      true,
    );
  });
});
