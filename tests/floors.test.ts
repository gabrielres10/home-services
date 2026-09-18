import { describe, expect, it } from "vitest";
import { floorDisplayName } from "@/lib/domain/floors";

describe("floorDisplayName", () => {
  it("une el piso con la persona asociada", () => {
    expect(floorDisplayName("Piso 1", "Nasly")).toBe("Piso 1 · Nasly");
    expect(floorDisplayName("Piso 2", "Lucy")).toBe("Piso 2 · Lucy");
    expect(floorDisplayName("Piso 3", "Juan")).toBe("Piso 3 · Juan");
  });

  it("deja solo el piso si no hay nombre", () => {
    expect(floorDisplayName("Piso 1")).toBe("Piso 1");
    expect(floorDisplayName("Piso 1", "  ")).toBe("Piso 1");
    expect(floorDisplayName("Piso 1", null)).toBe("Piso 1");
  });
});
