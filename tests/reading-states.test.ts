import { describe, expect, it } from "vitest";
import {
  canTransitionReadingStatus,
  floorUserCanMutate,
  statusAfterFloorResubmit,
} from "@/lib/domain/reading-states";

describe("reading state transitions", () => {
  it("el usuario de piso no puede aprobar", () => {
    expect(
      canTransitionReadingStatus({
        from: "pending",
        to: "approved",
        role: "floor_user",
      }),
    ).toBe(false);
  });

  it("el usuario de piso puede reenviar una lectura rechazada", () => {
    expect(
      canTransitionReadingStatus({
        from: "rejected",
        to: "pending",
        role: "floor_user",
      }),
    ).toBe(true);
    expect(statusAfterFloorResubmit()).toBe("pending");
  });

  it("el administrador puede aprobar o rechazar", () => {
    expect(
      canTransitionReadingStatus({ from: "pending", to: "approved", role: "admin" }),
    ).toBe(true);
    expect(
      canTransitionReadingStatus({ from: "pending", to: "rejected", role: "admin" }),
    ).toBe(true);
  });

  it("una lectura aprobada no es editable por el piso", () => {
    expect(floorUserCanMutate("approved")).toBe(false);
    expect(floorUserCanMutate("pending")).toBe(true);
    expect(floorUserCanMutate("rejected")).toBe(true);
  });
});
