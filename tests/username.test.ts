import { describe, expect, it } from "vitest";
import {
  emailForUsername,
  normalizeUsername,
  parseUsername,
} from "@/lib/domain/username";

describe("username", () => {
  it("normaliza mayúsculas y toma la parte antes de @ si pegan un correo viejo", () => {
    expect(normalizeUsername("  Admin  ")).toBe("admin");
    expect(normalizeUsername("Nasly@correo.com")).toBe("nasly");
  });

  it("acepta usuarios simples y arma el correo interno de Auth", () => {
    expect(parseUsername("lucy")).toEqual({ ok: true, value: "lucy" });
    expect(emailForUsername("lucy")).toBe("lucy@vivienda.local");
    expect(parseUsername("piso-1").ok).toBe(true);
  });

  it("rechaza vacíos y caracteres raros", () => {
    expect(parseUsername("").ok).toBe(false);
    expect(parseUsername("1nasly").ok).toBe(false);
    expect(parseUsername("nas ly").ok).toBe(false);
  });
});
