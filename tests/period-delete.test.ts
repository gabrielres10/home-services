import { describe, expect, it } from "vitest";
import { periodDeleteConfirmationError } from "@/lib/domain/period-delete";

describe("periodDeleteConfirmationError", () => {
  it("bloquea si no hay casilla ni nombre exacto", () => {
    expect(
      periodDeleteConfirmationError({
        confirmed: false,
        typedLabel: "(2026) ENE 11 a FEB 11",
        periodLabel: "(2026) ENE 11 a FEB 11",
      }),
    ).toMatch(/casilla/i);
    expect(
      periodDeleteConfirmationError({
        confirmed: true,
        typedLabel: "ene 11",
        periodLabel: "(2026) ENE 11 a FEB 11",
      }),
    ).toMatch(/nombre del período/i);
  });

  it("deja pasar solo con casilla y nombre idéntico", () => {
    expect(
      periodDeleteConfirmationError({
        confirmed: true,
        typedLabel: "  (2026) ENE 11 a FEB 11  ",
        periodLabel: "(2026) ENE 11 a FEB 11",
      }),
    ).toBeNull();
  });
});
