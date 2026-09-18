import { describe, expect, it } from "vitest";
import { periodLabelFromDates } from "@/lib/domain/period-label";

describe("periodLabelFromDates", () => {
  it("mismo año: (2026) FEB 11 a MAR 12", () => {
    expect(periodLabelFromDates("2026-02-11", "2026-03-12")).toBe(
      "(2026) FEB 11 a MAR 12",
    );
  });

  it("mismo año: (2026) ENE 10 a FEB 11", () => {
    expect(periodLabelFromDates("2026-01-10", "2026-02-11")).toBe(
      "(2026) ENE 10 a FEB 11",
    );
  });

  it("años distintos: 2025 DIC 12 a 2026 ENE 10", () => {
    expect(periodLabelFromDates("2025-12-12", "2026-01-10")).toBe(
      "2025 DIC 12 a 2026 ENE 10",
    );
  });

  it("no rellena el día con cero", () => {
    expect(periodLabelFromDates("2026-03-01", "2026-03-09")).toBe(
      "(2026) MAR 1 a MAR 9",
    );
  });

  it("rechaza fechas inválidas", () => {
    expect(periodLabelFromDates("", "2026-03-12")).toBeNull();
    expect(periodLabelFromDates("11/02/2026", "2026-03-12")).toBeNull();
  });
});
