import { describe, expect, it } from "vitest";
import { hashSessionToken, newSessionToken } from "@/lib/auth/session-token";

describe("session token", () => {
  it("genera tokens largos, distintos y seguros para una cookie", () => {
    const first = newSessionToken();
    const second = newSessionToken();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("guarda solo un hash SHA-256 estable del token", () => {
    const token = newSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashSessionToken(token));
    expect(hash).not.toContain(token);
    expect(hashSessionToken("otro")).not.toBe(hash);
  });
});
