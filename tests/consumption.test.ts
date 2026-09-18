import { describe, expect, it } from "vitest";
import {
  approvedValueOrNull,
  consumptionFromApprovedReadings,
  findPreviousApprovedValue,
  readingDifference,
  unmeteredFloorConsumption,
} from "@/lib/domain/consumption";

describe("readingDifference", () => {
  it("calcula 1301 - 1284 = 17", () => {
    expect(readingDifference(1301, 1284)).toBe(17);
  });
});

describe("consumptionFromApprovedReadings", () => {
  it("usa solo valores aprobados", () => {
    expect(consumptionFromApprovedReadings(1301, 1284)).toEqual({
      status: "ok",
      consumption: 17,
    });
  });

  it("no calcula si falta la anterior", () => {
    expect(consumptionFromApprovedReadings(1301, null)).toEqual({
      status: "missing_previous",
    });
  });
});

describe("unmeteredFloorConsumption", () => {
  it("total 100, piso1 35, piso2 40 => piso3 25", () => {
    expect(unmeteredFloorConsumption(100, [35, 40])).toEqual({
      status: "ok",
      consumption: 25,
    });
  });

  it("total 50, piso1 30, piso2 25 => error negativo", () => {
    expect(unmeteredFloorConsumption(50, [30, 25])).toEqual({
      status: "negative",
      consumption: -5,
    });
  });

  it("queda incompleto si falta un consumo medido", () => {
    expect(unmeteredFloorConsumption(100, [35, null])).toEqual({
      status: "incomplete",
    });
  });
});

describe("findPreviousApprovedValue", () => {
  it("ignora lecturas pendientes y usa la última aprobada anterior", () => {
    const value = findPreviousApprovedValue("2026-09-01", [
      { periodEndsOn: "2026-08-31", status: "pending", value: 9999 },
      { periodEndsOn: "2026-08-31", status: "approved", value: 1284 },
      { periodEndsOn: "2026-07-31", status: "approved", value: 1200 },
      { periodEndsOn: "2026-09-30", status: "approved", value: 1301 },
    ]);
    expect(value).toBe(1284);
  });

  it("no usa una lectura pendiente como anterior", () => {
    const value = findPreviousApprovedValue("2026-09-01", [
      { periodEndsOn: "2026-08-31", status: "pending", value: 1500 },
      { periodEndsOn: "2026-08-31", status: "rejected", value: 1400 },
    ]);
    expect(value).toBeNull();
  });
});

describe("approvedValueOrNull", () => {
  it("solo expone el valor si está aprobado", () => {
    expect(approvedValueOrNull("approved", 10)).toBe(10);
    expect(approvedValueOrNull("pending", 10)).toBeNull();
  });
});
