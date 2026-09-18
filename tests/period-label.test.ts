import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  periodLabelFromDates,
  suggestNextPeriodDates,
} from "@/lib/domain/period-label";

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

describe("suggestNextPeriodDates", () => {
  it("empieza al día siguiente del último fin y suma 30 días", () => {
    expect(suggestNextPeriodDates("2026-03-11")).toEqual({
      startsOn: "2026-03-12",
      endsOn: "2026-04-11",
    });
    expect(suggestNextPeriodDates("2026-04-10")).toEqual({
      startsOn: "2026-04-11",
      endsOn: "2026-05-11",
    });
  });

  it("cruza de año y respeta febrero bisiesto", () => {
    expect(suggestNextPeriodDates("2025-12-15")).toEqual({
      startsOn: "2025-12-16",
      endsOn: "2026-01-15",
    });
    expect(addCalendarDays("2024-02-10", 1)).toBe("2024-02-11");
    expect(suggestNextPeriodDates("2024-01-31")).toEqual({
      startsOn: "2024-02-01",
      endsOn: "2024-03-02",
    });
  });

  it("rechaza un fin inválido", () => {
    expect(suggestNextPeriodDates("")).toBeNull();
    expect(suggestNextPeriodDates("11/03/2026")).toBeNull();
  });
});
