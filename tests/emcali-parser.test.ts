import { describe, expect, it } from "vitest";
import { normalizeBillLabel, parseEmcaliBillText, parseUsBillNumber } from "@/lib/billing/emcali-parser";
import { reconstructPdfLines } from "@/lib/billing/pdf-text";

const SAMPLE_PAGE_1 = `
ACUEDUCTO
Dir Instalación CR 79 1 B1-07
Consumo del mes en M3 23
CONCEPTOS Cantidad M3 Valor Unitario Valor Total Subsidio Total a Pagar
Cargo Básico 11,941.55 -8,120.25 3,821.30
Consumo Básico Hasta 16 16.00 3,343.79 53,500.64 -36,380.48 17,120.16
Consumo Mayor Al Básico 7 7.00 3,343.79 23,406.53 23,406.53
(-) Minimo Vital 6.00 1,070.01 -6,420.06 -6,420.06
Ajuste al Peso .07
TOTAL $37,928.00

ALCANTARILLADO
Vertimiento 23 M3
CONCEPTOS Cantidad M3 Valor Unitario Valor Total Subsidio Total a Pagar
Cargo Básico 6,404.94 -4,355.36 2,049.58
Consumo Básico Hasta 16 16.00 3,833.47 61,335.52 -41,708.16 19,627.36
Consumo Mayor Al Básico 7 7.00 3,833.47 26,834.29 26,834.29
(-)Ajuste al Peso .23
TOTAL $48,511.00

ENERGIA
Consumo Actual 553 KWH
CONCEPTOS Cantidad Valor Unitario Valor Total Subsidio Total a Pagar
Consumo De Energía Activa
Consumo Básico Hasta 173 173.00 868.56 150,261.04 -77,226.82 73,034.22
Consumo Mayor Al Básico 380 380.00 868.56 330,053.14 330,053.14
Vr. Consumo Recuperado 2026/06 35.00 828.95 29,013.18 29,013.18
Ajuste al Peso .42
TOTAL $432,100.96

ULTIMO PAGO
TOTAL A PAGAR ESTE MES
SubTotal Servicios EMCALI 518,539.96
SubTotal Otros Servicios + AP 65,869.04
+ IVA .00
TOTAL OPERACIÓN MES 584,409.00
TOTAL A PAGAR $584,409.00
`;

function amount(
  draft: ReturnType<typeof parseEmcaliBillText>,
  service: string,
  charge: string,
): number | null {
  return (
    draft.charges.find((item) => item.serviceCode === service && item.chargeCode === charge)
      ?.amount ?? null
  );
}

function total(draft: ReturnType<typeof parseEmcaliBillText>, service: string): number | null {
  return draft.totals.find((item) => item.serviceCode === service)?.totalConsumption ?? null;
}

describe("parseUsBillNumber", () => {
  it("lee el formato del PDF EMCALI", () => {
    expect(parseUsBillNumber("73,034.22")).toBe(73034.22);
    expect(parseUsBillNumber(".07")).toBe(0.07);
    expect(parseUsBillNumber("-6,420.06")).toBe(-6420.06);
    expect(parseUsBillNumber("$37,928.00")).toBe(37928);
  });
});

describe("normalizeBillLabel", () => {
  it("quita la cantidad del mayor al básico", () => {
    expect(normalizeBillLabel("Consumo Mayor Al Básico 7")).toBe("consumo mayor al basico");
    expect(normalizeBillLabel("Consumo Mayor Al Básico 380")).toBe("consumo mayor al basico");
    expect(normalizeBillLabel("Consumo Básico Hasta 173")).toBe("consumo basico hasta 173");
  });
});

describe("parseEmcaliBillText", () => {
  it("extrae consumos, Total a Pagar y el subtotal AP del ejemplo", () => {
    const draft = parseEmcaliBillText(SAMPLE_PAGE_1);
    expect(draft.source).toBe("pdf");
    expect(total(draft, "energia")).toBe(553);
    expect(total(draft, "agua")).toBe(23);
    expect(total(draft, "alcantarillado")).toBe(23);

    expect(amount(draft, "agua", "cargo_basico")).toBeCloseTo(3821.3);
    expect(amount(draft, "agua", "consumo_basico_hasta_16")).toBeCloseTo(17120.16);
    expect(amount(draft, "agua", "consumo_mayor_al_basico")).toBeCloseTo(23406.53);
    expect(amount(draft, "agua", "minimo_vital")).toBeCloseTo(-6420.06);
    expect(amount(draft, "agua", "ajuste_al_peso")).toBeCloseTo(0.07);
    expect(amount(draft, "agua", "interes_mora")).toBe(0);

    expect(amount(draft, "alcantarillado", "cargo_basico")).toBeCloseTo(2049.58);
    expect(amount(draft, "alcantarillado", "consumo_basico_hasta_16")).toBeCloseTo(19627.36);
    expect(amount(draft, "alcantarillado", "consumo_mayor_al_basico")).toBeCloseTo(26834.29);
    expect(amount(draft, "alcantarillado", "ajuste_al_peso")).toBeCloseTo(-0.23);
    expect(amount(draft, "alcantarillado", "interes_mora")).toBe(0);

    expect(amount(draft, "energia", "consumo_basico_hasta_173")).toBeCloseTo(73034.22);
    expect(amount(draft, "energia", "consumo_mayor_al_basico")).toBeCloseTo(330053.14);
    expect(amount(draft, "energia", "otros_cobros")).toBeCloseTo(29013.18);
    expect(amount(draft, "energia", "ajuste_al_peso")).toBeCloseTo(0.42);
    expect(amount(draft, "energia", "interes_mora")).toBe(0);

    expect(draft.otherServicesApSubtotal).toBeCloseTo(65869.04);
  });

  it("acepta el texto reconstruido renglón por renglón como en pdf.js", () => {
    const lines = SAMPLE_PAGE_1.split("\n").map((line) => line.trim()).filter(Boolean);
    const items = lines.map((line, index) => ({
      str: line,
      x: 0,
      y: 2000 - index * 12,
    }));
    const draft = parseEmcaliBillText(reconstructPdfLines(items));
    expect(total(draft, "energia")).toBe(553);
    expect(amount(draft, "energia", "otros_cobros")).toBeCloseTo(29013.18);
    expect(draft.otherServicesApSubtotal).toBeCloseTo(65869.04);
  });

  it("rescata Total a Pagar cuando pdf.js parte cada celda en un renglón", () => {
    const draft = parseEmcaliBillText(`
ACUEDUCTO
Consumo del mes en M3
23
Cargo Básico
11,941.55
-8,120.25
3,821.30
Consumo Básico Hasta 16
16.00
3,343.79
53,500.64
-36,380.48
17,120.16
ALCANTARILLADO
Vertimiento
23
ENERGIA
Consumo Actual
553
Consumo Básico Hasta 173
73,034.22
SubTotal Otros Servicios + AP
65,869.04
`);
    expect(total(draft, "agua")).toBe(23);
    expect(total(draft, "energia")).toBe(553);
    expect(amount(draft, "agua", "cargo_basico")).toBeCloseTo(3821.3);
    expect(amount(draft, "agua", "consumo_basico_hasta_16")).toBeCloseTo(17120.16);
    expect(amount(draft, "energia", "consumo_basico_hasta_173")).toBeCloseTo(73034.22);
    expect(draft.otherServicesApSubtotal).toBeCloseTo(65869.04);
  });

  it("no rellena mora de un servicio que no apareció", () => {
    const draft = parseEmcaliBillText(`
ACUEDUCTO
Consumo del mes en M3 23
Cargo Básico 3,821.30
`);
    expect(amount(draft, "agua", "interes_mora")).toBe(0);
    expect(amount(draft, "energia", "interes_mora")).toBeNull();
    expect(amount(draft, "energia", "otros_cobros")).toBeNull();
  });

  it("deja otros cobros de energía en 0 si no hay Consumo Recuperado ni Otros Cobros", () => {
    const draft = parseEmcaliBillText(`
ENERGIA
Consumo Actual 594 KWH
Promedio 534.00
CONCEPTOS Cantidad Valor Unitario Valor Total Subsidio Total a Pagar
Consumo De Energía Activa
Consumo Básico Hasta 173 173.00 868.56 150,261.04 -77,226.82 73,319.16
Consumo Mayor Al Básico 421 421.00 905.67 380,486.83 380,486.83
Ajuste al Peso .15
TOTAL $453,806.14
`);
    expect(total(draft, "energia")).toBe(594);
    expect(amount(draft, "energia", "consumo_basico_hasta_173")).toBeCloseTo(73319.16);
    expect(amount(draft, "energia", "consumo_mayor_al_basico")).toBeCloseTo(380486.83);
    expect(amount(draft, "energia", "ajuste_al_peso")).toBeCloseTo(0.15);
    expect(amount(draft, "energia", "otros_cobros")).toBe(0);
  });

  it("trata (-) en la etiqueta como signo negativo del importe", () => {
    const draft = parseEmcaliBillText(`
ACUEDUCTO
Consumo del mes en M3 23
(-) Minimo Vital 6.00 1,070.01 6,420.06 6,420.06
(-) Ajuste al peso: 0.2
ALCANTARILLADO
(-)Ajuste al Peso -.23
ENERGIA
Consumo Actual 594 KWH
Consumo Básico Hasta 173 73,319.16
(-)
Ajuste al Peso
.15
`);
    expect(amount(draft, "agua", "minimo_vital")).toBeCloseTo(-6420.06);
    expect(amount(draft, "agua", "ajuste_al_peso")).toBeCloseTo(-0.2);
    expect(amount(draft, "alcantarillado", "ajuste_al_peso")).toBeCloseTo(-0.23);
    expect(amount(draft, "energia", "ajuste_al_peso")).toBeCloseTo(-0.15);
  });

  it("suma Otros Cobros y Consumo Recuperado en el mismo renglón de energía", () => {
    const draft = parseEmcaliBillText(`
ENERGIA
Consumo Actual 553 KWH
Consumo Básico Hasta 173 173.00 868.56 73,034.22
Otros Cobros 534.00 534.00
Vr. Consumo Recuperado 2026/06 35.00 828.95 29,013.18 29,013.18
Ajuste al Peso .42
`);
    expect(amount(draft, "energia", "otros_cobros")).toBeCloseTo(29547.18);
  });
});
