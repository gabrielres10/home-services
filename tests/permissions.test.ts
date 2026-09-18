import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canDeletePeriod,
  canReviewReadings,
  canSubmitReading,
  canViewPhoto,
  canViewReading,
} from "@/lib/domain/permissions";

describe("permissions", () => {
  it("solo el administrador entra al área admin", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("floor_user")).toBe(false);
    expect(canReviewReadings("floor_user")).toBe(false);
    expect(canDeletePeriod("admin")).toBe(true);
    expect(canDeletePeriod("floor_user")).toBe(false);
  });

  it("un usuario de piso no ve lecturas de otro piso", () => {
    expect(
      canViewReading({
        role: "floor_user",
        actorFloorId: "piso-1",
        readingFloorId: "piso-2",
      }),
    ).toBe(false);
    expect(
      canViewPhoto({
        role: "floor_user",
        actorFloorId: "piso-1",
        readingFloorId: "piso-2",
      }),
    ).toBe(false);
  });

  it("un usuario de piso sí ve y envía las suyas si el período está abierto", () => {
    expect(
      canViewReading({
        role: "floor_user",
        actorFloorId: "piso-1",
        readingFloorId: "piso-1",
      }),
    ).toBe(true);
    expect(
      canSubmitReading({
        role: "floor_user",
        actorFloorId: "piso-1",
        readingFloorId: "piso-1",
        periodOpen: true,
        readingStatus: "pending",
      }),
    ).toBe(true);
  });

  it("no puede enviar una lectura ya aprobada ni la de otro piso", () => {
    expect(
      canSubmitReading({
        role: "floor_user",
        actorFloorId: "piso-1",
        readingFloorId: "piso-1",
        periodOpen: true,
        readingStatus: "approved",
      }),
    ).toBe(false);
    expect(
      canSubmitReading({
        role: "floor_user",
        actorFloorId: "piso-1",
        readingFloorId: "piso-2",
        periodOpen: true,
        readingStatus: null,
      }),
    ).toBe(false);
  });
});
