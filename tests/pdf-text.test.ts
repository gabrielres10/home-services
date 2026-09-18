import { describe, expect, it } from "vitest";
import {
  collapseSpacedLetterRuns,
  reconstructPdfLines,
  toPositionedText,
} from "@/lib/billing/pdf-text";

describe("toPositionedText", () => {
  it("acepta transform como Float32Array, que no pasa Array.isArray", () => {
    const transform = new Float32Array([1, 0, 0, 1, 120.5, 640.25]);
    expect(Array.isArray(transform)).toBe(false);
    const item = toPositionedText({
      str: "Cargo Básico",
      transform,
      height: 9,
      hasEOL: false,
    });
    expect(item).toEqual({
      str: "Cargo Básico",
      x: 120.5,
      y: 640.25,
      height: 9,
      hasEOL: false,
    });
  });
});

describe("collapseSpacedLetterRuns", () => {
  it("junta letras sueltas típicas de pdf.js", () => {
    expect(collapseSpacedLetterRuns("A C U E D U C T O")).toBe("ACUEDUCTO");
    expect(collapseSpacedLetterRuns("E N E R G I A")).toBe("ENERGIA");
  });
});

describe("reconstructPdfLines", () => {
  it("junta celdas de la misma fila por y", () => {
    const text = reconstructPdfLines([
      { str: "Cargo Básico", x: 10, y: 500, height: 10 },
      { str: "3,821.30", x: 400, y: 502, height: 10 },
    ]);
    expect(text).toBe("Cargo Básico 3,821.30");
  });
});
