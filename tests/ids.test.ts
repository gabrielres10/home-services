import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/domain/ids";

describe("isUuid", () => {
  it("acepta uuid válidos", () => {
    expect(isUuid("0b6f5c2e-1d7a-4c52-9a54-3f1d2b8e7a10")).toBe(true);
    expect(isUuid("0B6F5C2E-1D7A-4C52-9A54-3F1D2B8E7A10")).toBe(true);
  });

  it("rechaza lo que PostgreSQL no podría convertir a uuid", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid("abc")).toBe(false);
    expect(isUuid("0b6f5c2e-1d7a-4c52-9a54-3f1d2b8e7a1")).toBe(false);
    expect(isUuid("0b6f5c2e-1d7a-4c52-9a54-3f1d2b8e7a10%")).toBe(false);
    expect(isUuid("' or 1=1 --")).toBe(false);
  });
});
