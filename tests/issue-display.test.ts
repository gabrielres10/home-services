import { groupIssuesForDisplay, uniqueIssues } from "@/lib/domain/issue-display";
import type { ValidationIssue } from "@/lib/domain/types";
import { describe, expect, it } from "vitest";

describe("groupIssuesForDisplay", () => {
  it("junta las faltas del recibo en un solo aviso", () => {
    const issues: ValidationIssue[] = [
      { code: "bill.pdf_missing", severity: "error", message: "Falta el PDF del recibo." },
      {
        code: "bill.energy_missing",
        severity: "error",
        message: "Falta el consumo total de energía.",
      },
      { code: "bill.water_missing", severity: "error", message: "Falta el consumo total de agua." },
      {
        code: "bill.sewer_missing",
        severity: "error",
        message: "Falta el consumo total de alcantarillado.",
      },
      {
        code: "bill.charge_missing",
        severity: "error",
        message: "Falta el importe de Energía: Consumo básico hasta 173 kWh.",
      },
      {
        code: "bill.charge_missing",
        severity: "error",
        message: "Falta el importe de Agua: Cargo básico.",
      },
      {
        code: "bill.other_services_ap_missing",
        severity: "error",
        message: "Falta el subtotal de otros servicios + AP (alumbrado público).",
      },
    ];

    const notices = groupIssuesForDisplay(issues);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.title).toMatch(/recibo aún no está completo/i);
    expect(notices[0]?.items).toEqual([
      "PDF del recibo",
      "Consumos totales (agua, alcantarillado y energía)",
      "2 importes en pesos",
      "Subtotal de otros servicios + AP",
    ]);
  });

  it("deja un aviso suelto si solo falta una cosa", () => {
    const notices = groupIssuesForDisplay([
      { code: "bill.pdf_missing", severity: "error", message: "Falta el PDF del recibo." },
    ]);
    expect(notices).toEqual([
      { severity: "error", title: "Falta el PDF del recibo.", items: [] },
    ]);
  });

  it("no mezcla un aviso distinto con el resumen del recibo", () => {
    const notices = groupIssuesForDisplay([
      { code: "bill.pdf_missing", severity: "error", message: "Falta el PDF del recibo." },
      { code: "bill.energy_missing", severity: "error", message: "Falta el consumo total de energía." },
      {
        code: "bill.sewer_differs_from_water",
        severity: "warning",
        message: "El total de alcantarillado no coincide con el de agua.",
      },
    ]);
    expect(notices).toHaveLength(2);
    expect(notices[0]?.items).toContain("PDF del recibo");
    expect(notices[1]?.severity).toBe("warning");
  });
});

describe("uniqueIssues", () => {
  it("quita duplicados", () => {
    const issues: ValidationIssue[] = [
      { code: "a", severity: "error", message: "Uno" },
      { code: "a", severity: "error", message: "Uno" },
    ];
    expect(uniqueIssues(issues)).toHaveLength(1);
  });
});
