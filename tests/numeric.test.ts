import { describe, expect, it } from "vitest";
import {
  explainNumericReject,
  formatGroupedFromRaw,
  formatMoneyValue,
  formatQuantityValue,
  isNumericDraft,
  numberToInputRaw,
  parseNumericRaw,
  sumMoneyRaws,
} from "@/lib/domain/numeric";

describe("isNumericDraft", () => {
  it("admite dígitos, coma decimal y menos inicial", () => {
    expect(isNumericDraft("")).toBe(true);
    expect(isNumericDraft("-")).toBe(true);
    expect(isNumericDraft("100000")).toBe(true);
    expect(isNumericDraft("-300")).toBe(true);
    expect(isNumericDraft("12,")).toBe(true);
    expect(isNumericDraft("12,5")).toBe(true);
    expect(isNumericDraft("-1,25")).toBe(true);
  });

  it("rechaza puntos, espacios y letras", () => {
    expect(isNumericDraft("100.000")).toBe(false);
    expect(isNumericDraft("1 000")).toBe(false);
    expect(isNumericDraft("12.5")).toBe(false);
    expect(isNumericDraft("12a")).toBe(false);
    expect(isNumericDraft("1,2,3")).toBe(false);
    expect(isNumericDraft("12-3")).toBe(false);
  });
});

describe("parseNumericRaw", () => {
  it("convierte la coma en decimal", () => {
    expect(parseNumericRaw("1301,5")).toBe(1301.5);
    expect(parseNumericRaw("100000")).toBe(100000);
    expect(parseNumericRaw("-300")).toBe(-300);
  });

  it("no acepta punto ni espacios", () => {
    expect(parseNumericRaw("1301.5")).toBeNull();
    expect(parseNumericRaw("1 301")).toBeNull();
    expect(parseNumericRaw("12,")).toBeNull();
  });
});

describe("formatGroupedFromRaw", () => {
  it("formatea miles con punto y pesos con $ sin tocar el valor crudo", () => {
    expect(formatGroupedFromRaw("100000", "quantity")).toBe("100.000");
    expect(formatGroupedFromRaw("100000", "money")).toBe("$100.000");
    expect(formatGroupedFromRaw("100000,5", "money")).toBe("$100.000,5");
    expect(formatGroupedFromRaw("-300", "money")).toBe("-$300");
    expect(formatGroupedFromRaw("1603,6", "quantity")).toBe("1.603,6");
  });
});

describe("sumMoneyRaws", () => {
  it("suma importes de una sección y redondea a centavos", () => {
    expect(
      sumMoneyRaws(["3821,30", "17120,16", "23406,53", "-6420,06", "0", "0,07"]),
    ).toBe(37928);
    expect(sumMoneyRaws(["73319,16", "380486,83", "0", "0", "0,15"])).toBe(453806.14);
    expect(sumMoneyRaws(["", "-", "12,"])).toBeNull();
  });
});

describe("formatters", () => {
  it("muestra dinero y cantidades con el formato visual colombiano", () => {
    expect(formatMoneyValue(100000)).toBe("$100.000");
    expect(formatMoneyValue(-300)).toBe("-$300");
    expect(formatQuantityValue(1603.6)).toBe("1.603,6");
    expect(numberToInputRaw(1603.6)).toBe("1603,6");
    expect(numberToInputRaw(100000)).toBe("100000");
  });
});

describe("explainNumericReject", () => {
  it("explica punto y espacio", () => {
    expect(explainNumericReject("100.000")).toMatch(/puntos ni espacios/i);
    expect(explainNumericReject("1 000")).toMatch(/puntos ni espacios/i);
  });
});
