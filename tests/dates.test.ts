import { describe, expect, it } from "vitest";
import {
  formatChosenDate,
  monthGrid,
  shiftMonth,
} from "@/lib/domain/dates";

describe("formatChosenDate", () => {
  it("usa día, nombre del mes y año", () => {
    expect(formatChosenDate("2026-08-11")).toBe("11 / agosto / 2026");
    expect(formatChosenDate("2026-03-01")).toBe("1 / marzo / 2026");
  });

  it("rechaza fechas inválidas", () => {
    expect(formatChosenDate("")).toBeNull();
    expect(formatChosenDate("08/11/2026")).toBeNull();
  });
});

describe("monthGrid", () => {
  it("empieza el lunes y rellena agosto de 2026", () => {
    const grid = monthGrid(2026, 8);
    expect(grid.slice(0, 7)).toEqual([null, null, null, null, null, 1, 2]);
    expect(grid.filter((day) => day !== null).at(-1)).toBe(31);
  });
});

describe("shiftMonth", () => {
  it("cruza de año", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
  });
});
