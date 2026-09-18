import {
  BILL_CHARGE_CATALOG,
  type BillChargeField,
} from "@/lib/domain/bill-charges";
import type { ServiceCode } from "@/lib/domain/types";
import type { BillChargeInput, BillServiceTotalInput, ExtractedBillDraft } from "./extractor";
import { collapseSpacedLetterRuns } from "./pdf-text";

const MONEY_OR_DECIMAL =
  /(?<![A-Za-z])-?\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\$?\d+\.\d+|-?\$?\.\d+/g;
const US_NUMBER =
  /(?<![A-Za-z])-?\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\$?\d+\.\d+|-?\$?\.\d+|-?\$?\d+(?![A-Za-z0-9])/g;

export function parseUsBillNumber(raw: string): number | null {
  let text = raw.trim().replace(/[$\s]/g, "");
  if (text === "") {
    return null;
  }
  let negative = false;
  if (text.startsWith("-") || text.startsWith("(")) {
    negative = true;
    text = text.replace(/^[-()]+/, "").replace(/\)+$/, "");
  }
  if (/^\.\d+$/.test(text)) {
    text = `0${text}`;
  }
  if (!/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$|^\d+\.\d+$|^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(value)) {
    return null;
  }
  return negative ? -value : value;
}

export function normalizeBillLabel(raw: string): string {
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(\s*-\s*\)/g, " ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.replace(/\bconsumo mayor al basico(?:\s+\d+)?$/, "consumo mayor al basico");
}

function hasCreditMarker(text: string): boolean {
  return /\(\s*[-−–]\s*\)/.test(text);
}

function isCreditMarkerOnly(line: string): boolean {
  return hasCreditMarker(line) && line.replace(/\(\s*[-−–]\s*\)/g, " ").replace(/\$/g, "").trim() === "";
}

function applyCreditSign(amount: number, credit: boolean): number {
  if (!credit || amount === 0) {
    return amount;
  }
  return -Math.abs(amount);
}

function moneyNumbersIn(text: string): number[] {
  const matches = text.match(MONEY_OR_DECIMAL) ?? [];
  return matches.flatMap((match) => {
    const value = parseUsBillNumber(match);
    return value === null ? [] : [value];
  });
}

function numbersIn(text: string): number[] {
  const matches = text.match(US_NUMBER) ?? [];
  return matches.flatMap((match) => {
    const value = parseUsBillNumber(match);
    return value === null ? [] : [value];
  });
}

function lastNumber(text: string): number | null {
  const values = numbersIn(text);
  return values.length === 0 ? null : (values[values.length - 1] ?? null);
}

function firstNumber(text: string): number | null {
  const values = numbersIn(text);
  return values.length === 0 ? null : (values[0] ?? null);
}

function sliceSection(text: string, start: RegExp, end: RegExp | null): string {
  const source = text.replace(/\r/g, "");
  const startMatch = start.exec(source);
  if (!startMatch || startMatch.index === undefined) {
    return "";
  }
  const from = startMatch.index + startMatch[0].length;
  if (!end) {
    return source.slice(from);
  }
  end.lastIndex = 0;
  const rest = source.slice(from);
  const endMatch = end.exec(rest);
  return endMatch && endMatch.index !== undefined ? rest.slice(0, endMatch.index) : rest;
}

function findLabeledNumber(section: string, pattern: RegExp): number | null {
  const match = pattern.exec(section);
  if (!match) {
    return null;
  }
  const after = match[1] ? match[1] : section.slice(match.index + match[0].length, match.index + match[0].length + 80);
  return firstNumber(after) ?? lastNumber(match[0]);
}

type ChargeCode = string;

function waterOrSewerCharge(label: string): ChargeCode | "skip" | null {
  if (label === "total" || label.startsWith("total ")) {
    return "skip";
  }
  if (label.includes("cargo basico")) {
    return "cargo_basico";
  }
  if (label.includes("consumo basico hasta 16")) {
    return "consumo_basico_hasta_16";
  }
  if (label.includes("consumo mayor al basico")) {
    return "consumo_mayor_al_basico";
  }
  if (label.includes("minimo vital")) {
    return "minimo_vital";
  }
  if (label.includes("ajuste al peso")) {
    return "ajuste_al_peso";
  }
  if (label.includes("interes de mora") || label.includes("interes mora")) {
    return "interes_mora";
  }
  if (label.includes("conceptos") || label.includes("cantidad") || label.includes("valor unitario")) {
    return "skip";
  }
  return null;
}

function energyCharge(label: string): ChargeCode | "skip" | "otros" | null {
  if (label === "total" || label.startsWith("total ")) {
    return "skip";
  }
  if (label.includes("consumo de energia activa") && !label.includes("basico") && !label.includes("mayor")) {
    return "skip";
  }
  if (label.includes("consumo basico hasta 173")) {
    return "consumo_basico_hasta_173";
  }
  if (label.includes("consumo mayor al basico")) {
    return "consumo_mayor_al_basico";
  }
  if (label.includes("ajuste al peso")) {
    return "ajuste_al_peso";
  }
  if (label.includes("interes de mora") || label.includes("interes mora")) {
    return "interes_mora";
  }
  if (
    label.includes("conceptos") ||
    label.includes("cantidad") ||
    label.includes("valor unitario") ||
    label.includes("consumo actual") ||
    label.includes("lectura") ||
    label.includes("medidor")
  ) {
    return "skip";
  }
  if (label.includes("otros cobros") || label.includes("consumo recuperado")) {
    return "otros";
  }
  return null;
}

type ClassifiedLine = {
  label: string;
  numbers: number[];
  credit: boolean;
  kind: ChargeCode | "skip" | "otros" | null;
};

function classifyLine(
  line: string,
  classify: (label: string) => ChargeCode | "skip" | "otros" | null,
): ClassifiedLine {
  const numbers = moneyNumbersIn(line);
  const labelPart = line.replace(MONEY_OR_DECIMAL, " ").replace(/\$/g, " ");
  const label = normalizeBillLabel(labelPart);
  return {
    label,
    numbers,
    credit: hasCreditMarker(line),
    kind: label ? classify(label) : null,
  };
}

function parseConceptLines(
  section: string,
  classify: (label: string) => ChargeCode | "skip" | "otros" | null,
): { found: Record<string, number>; otros: number } {
  const found: Record<string, number> = {};
  let otros = 0;
  let pendingCredit = false;
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    if (isCreditMarkerOnly(raw)) {
      pendingCredit = true;
      continue;
    }

    const current = classifyLine(raw, classify);
    if (current.kind === "skip" || current.kind === null) {
      pendingCredit = false;
      continue;
    }

    let credit = current.credit || pendingCredit;
    pendingCredit = false;
    const collected = [...current.numbers];
    if (collected.length === 0) {
      let look = index + 1;
      while (look < lines.length) {
        const nextRaw = lines[look] ?? "";
        if (isCreditMarkerOnly(nextRaw)) {
          credit = true;
          look += 1;
          continue;
        }
        const next = classifyLine(nextRaw, classify);
        if (next.kind !== null) {
          break;
        }
        if (next.numbers.length === 0) {
          break;
        }
        if (next.credit) {
          credit = true;
        }
        collected.push(...next.numbers);
        look += 1;
      }
    }

    const unsigned = collected.at(-1);
    if (unsigned === undefined) {
      continue;
    }
    const amount = applyCreditSign(unsigned, credit);
    if (current.kind === "otros") {
      otros += amount;
      continue;
    }
    found[current.kind] = amount;
  }
  return { found, otros };
}

function catalogCharges(
  service: ServiceCode,
  found: Record<string, number>,
  extras?: { otrosCobros?: number },
): BillChargeInput[] {
  const sawService = Object.keys(found).length > 0 || (extras?.otrosCobros ?? 0) !== 0;
  const fields: readonly BillChargeField[] = BILL_CHARGE_CATALOG[service];
  return fields.map((field) => {
    if (field.code === "otros_cobros") {
      return {
        serviceCode: service,
        chargeCode: field.code,
        amount: sawService ? (extras?.otrosCobros ?? found[field.code] ?? 0) : null,
      };
    }
    if (field.code === "interes_mora") {
      return {
        serviceCode: service,
        chargeCode: field.code,
        amount: found[field.code] ?? (sawService ? 0 : null),
      };
    }
    return {
      serviceCode: service,
      chargeCode: field.code,
      amount: found[field.code] ?? null,
    };
  });
}

function totalFor(
  section: string,
  patterns: RegExp[],
): number | null {
  for (const pattern of patterns) {
    const value = findLabeledNumber(section, pattern);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

export function countExtractedValues(draft: ExtractedBillDraft): number {
  let count = 0;
  for (const total of draft.totals) {
    if (total.totalConsumption !== null) {
      count += 1;
    }
  }
  for (const charge of draft.charges) {
    if (charge.amount !== null) {
      count += 1;
    }
  }
  if (draft.otherServicesApSubtotal !== null) {
    count += 1;
  }
  return count;
}

export function parseEmcaliBillText(text: string): ExtractedBillDraft {
  const prepared = collapseSpacedLetterRuns(text.replace(/\r/g, ""));
  const aguaSection = sliceSection(
    prepared,
    /acueducto/i,
    /alcantarillado/i,
  );
  const sewerSection = sliceSection(
    prepared,
    /alcantarillado/i,
    /energ[ií]a/i,
  );
  const energySection = sliceSection(
    prepared,
    /energ[ií]a/i,
    /total a pagar este mes|ultimo pago|subtotal servicios emcali/i,
  );
  const footerSection = sliceSection(
    prepared,
    /total a pagar este mes|subtotal otros servicios/i,
    null,
  );

  const waterParsed = parseConceptLines(aguaSection, waterOrSewerCharge);
  const sewerParsed = parseConceptLines(sewerSection, waterOrSewerCharge);
  const energyParsed = parseConceptLines(energySection, energyCharge);

  const waterM3 =
    totalFor(aguaSection, [
      /consumo del mes en m\s*3[:\s]*([\d.,]+)/i,
      /consumo del mes[:\s]*([\d.,]+)/i,
    ]) ?? totalFor(prepared, [/consumo del mes en m\s*3[:\s]*([\d.,]+)/i]);
  const sewerM3 =
    totalFor(sewerSection, [/vertimiento[:\s]*([\d.,]+)/i]) ?? waterM3;
  const energyKwh =
    totalFor(energySection, [
      /consumo actual[:\s]*([\d.,]+)/i,
      /consumo actual[^\d]{0,20}([\d.,]+)/i,
    ]) ?? totalFor(prepared, [/consumo actual[:\s]*([\d.,]+)/i]);

  const otherServicesAp =
    findLabeledNumber(
      footerSection || prepared,
      /subtotal otros servicios\s*\+\s*ap[:\s$]*([\d.,]+)?/i,
    ) ??
    findLabeledNumber(prepared, /subtotal otros servicios\s*\+\s*ap[:\s$]*([\d.,]+)?/i);

  const totals: BillServiceTotalInput[] = [
    { serviceCode: "energia", totalConsumption: energyKwh },
    { serviceCode: "agua", totalConsumption: waterM3 },
    { serviceCode: "alcantarillado", totalConsumption: sewerM3 },
  ];

  const charges: BillChargeInput[] = [
    ...catalogCharges("energia", energyParsed.found, { otrosCobros: energyParsed.otros }),
    ...catalogCharges("agua", waterParsed.found),
    ...catalogCharges("alcantarillado", sewerParsed.found),
  ];

  return {
    source: "pdf",
    totals,
    charges,
    otherServicesApSubtotal: otherServicesAp,
  };
}
