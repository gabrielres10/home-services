import { describe, expect, it } from "vitest";
import {
  canClosePeriod,
  canMarkPeriodReady,
  canSubmitInPeriod,
  evaluatePeriodReadiness,
  nextReopenStatus,
  periodStatusLabel,
} from "@/lib/domain/period-status";

describe("period status", () => {
  it("solo se envían lecturas en un período abierto", () => {
    expect(canSubmitInPeriod("open")).toBe(true);
    expect(canSubmitInPeriod("ready")).toBe(false);
    expect(canSubmitInPeriod("closed")).toBe(false);
  });

  it("no marca listo si el piso 3 es negativo o faltan lecturas", () => {
    const blocked = evaluatePeriodReadiness({
      expectedCount: 4,
      approvedCount: 4,
      billComplete: true,
      allMeteredConsumptionsCalculable: true,
      hasNegativeUnmetered: true,
    });
    expect(blocked.ready).toBe(false);
    expect(canMarkPeriodReady("open", blocked)).toBe(false);

    const incomplete = evaluatePeriodReadiness({
      expectedCount: 4,
      approvedCount: 3,
      billComplete: true,
      allMeteredConsumptionsCalculable: true,
      hasNegativeUnmetered: false,
    });
    expect(incomplete.ready).toBe(false);
  });

  it("queda listo cuando recibo, lecturas y consumos son válidos", () => {
    const ready = evaluatePeriodReadiness({
      expectedCount: 4,
      approvedCount: 4,
      billComplete: true,
      allMeteredConsumptionsCalculable: true,
      hasNegativeUnmetered: false,
    });
    expect(ready.ready).toBe(true);
    expect(canMarkPeriodReady("open", ready)).toBe(true);
    expect(periodStatusLabel("open")).toBe("Pendiente de completar");
  });

  it("el período inicial queda listo con lecturas aprobadas, sin recibo ni consumo", () => {
    const ready = evaluatePeriodReadiness({
      expectedCount: 4,
      approvedCount: 4,
      billComplete: false,
      allMeteredConsumptionsCalculable: false,
      hasNegativeUnmetered: false,
      isOpeningPeriod: true,
    });
    expect(ready.ready).toBe(true);
    expect(canMarkPeriodReady("open", ready)).toBe(true);
  });

  it("cierra un período listo con liquidación, o el inicial sin recibo", () => {
    expect(
      canClosePeriod({ status: "ready", isOpeningPeriod: false, hasSettlement: true }),
    ).toBe(true);
    expect(
      canClosePeriod({ status: "ready", isOpeningPeriod: true, hasSettlement: false }),
    ).toBe(true);
    expect(
      canClosePeriod({ status: "ready", isOpeningPeriod: false, hasSettlement: false }),
    ).toBe(false);
    expect(
      canClosePeriod({ status: "open", isOpeningPeriod: false, hasSettlement: true }),
    ).toBe(false);
  });

  it("reabre cerrado a listo y listo a abierto", () => {
    expect(nextReopenStatus("closed")).toBe("ready");
    expect(nextReopenStatus("ready")).toBe("open");
    expect(nextReopenStatus("open")).toBeNull();
  });
});
