import { describe, expect, it } from "vitest";
import {
  currentLessThanPreviousIssue,
  hasBlockingErrors,
  parseReadingValue,
  validateBillTotals,
  validateReadingDraft,
} from "@/lib/domain/validation";

describe("parseReadingValue", () => {
  it("rechaza vacío", () => {
    const result = parseReadingValue("  ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue.code).toBe("reading.empty");
    }
  });

  it("rechaza no numérico", () => {
    const result = parseReadingValue("12a");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issue.code).toBe("reading.not_numeric");
    }
  });

  it("acepta 1301", () => {
    expect(parseReadingValue("1301")).toEqual({ ok: true, value: 1301 });
  });
});

describe("currentLessThanPreviousIssue", () => {
  it("detecta lectura actual menor que la anterior", () => {
    const issue = currentLessThanPreviousIssue(1200, 1284);
    expect(issue?.code).toBe("reading.current_less_than_previous");
    expect(issue?.severity).toBe("warning");
  });

  it("no alerta si la actual es mayor o igual", () => {
    expect(currentLessThanPreviousIssue(1301, 1284)).toBeNull();
  });
});

describe("validateReadingDraft", () => {
  it("exige fotografía y contador válido", () => {
    const issues = validateReadingDraft({
      rawValue: "1301",
      hasPhoto: false,
      previousApproved: 1284,
      hasEarlierPeriod: true,
      periodStatus: "open",
      hasMeter: true,
      serviceAllowed: true,
      alreadyHasApprovedReading: false,
    });
    expect(issues.some((issue) => issue.code === "reading.photo_missing")).toBe(true);
    expect(hasBlockingErrors(issues)).toBe(true);
  });

  it("alerta si falta lectura anterior en un período que no es el primero", () => {
    const issues = validateReadingDraft({
      rawValue: "1301",
      hasPhoto: true,
      previousApproved: null,
      hasEarlierPeriod: true,
      periodStatus: "open",
      hasMeter: true,
      serviceAllowed: true,
      alreadyHasApprovedReading: false,
    });
    expect(issues.some((issue) => issue.code === "reading.missing_previous")).toBe(true);
    expect(hasBlockingErrors(issues)).toBe(false);
  });

  it("el período inicial avisa lectura inicial y no exige un período aún más antiguo", () => {
    const issues = validateReadingDraft({
      rawValue: "1284",
      hasPhoto: true,
      previousApproved: null,
      hasEarlierPeriod: false,
      periodStatus: "open",
      hasMeter: true,
      serviceAllowed: true,
      alreadyHasApprovedReading: false,
    });
    expect(issues.some((issue) => issue.code === "reading.opening")).toBe(true);
    expect(issues.some((issue) => issue.code === "reading.missing_previous")).toBe(false);
    expect(hasBlockingErrors(issues)).toBe(false);
  });
});

describe("validateBillTotals", () => {
  it("avisa si alcantarillado no coincide con agua", () => {
    const issues = validateBillTotals({
      energy: 100,
      water: 50,
      sewer: 40,
      hasPdf: true,
    });
    expect(issues.some((issue) => issue.code === "bill.sewer_differs_from_water")).toBe(
      true,
    );
  });
});
