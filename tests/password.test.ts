import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("verifica la contraseña correcta y rechaza otra", async () => {
    const hash = await hashPassword("Clave-Segura-123");
    expect(await verifyPassword("Clave-Segura-123", hash)).toBe(true);
    expect(await verifyPassword("clave-segura-123", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("usa sal distinta en cada hash y guarda los parámetros en el texto", async () => {
    const first = await hashPassword("misma");
    const second = await hashPassword("misma");
    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$32768$8$1$")).toBe(true);
  });

  it("devuelve false con hashes mal formados en vez de lanzar", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$10$abc")).toBe(false);
    expect(await verifyPassword("x", "scrypt$no$es$un$hash$valido")).toBe(false);
  });
});
