import type { IssueSeverity, ValidationIssue } from "./types";

const BILL_INCOMPLETE_CODES = new Set([
  "bill.pdf_missing",
  "bill.energy_missing",
  "bill.water_missing",
  "bill.sewer_missing",
  "bill.charge_missing",
  "bill.other_services_ap_missing",
]);

export type IssueNotice = {
  severity: IssueSeverity;
  title: string;
  items: string[];
};

export function uniqueIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const unique: ValidationIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(issue);
  }
  return unique;
}

export function groupIssuesForDisplay(issues: ValidationIssue[]): IssueNotice[] {
  const unique = uniqueIssues(issues);
  const billIncomplete = unique.filter((issue) => BILL_INCOMPLETE_CODES.has(issue.code));
  const rest = unique.filter((issue) => !BILL_INCOMPLETE_CODES.has(issue.code));
  const notices: IssueNotice[] = [];

  if (billIncomplete.length === 1) {
    notices.push({
      severity: billIncomplete[0].severity,
      title: billIncomplete[0].message,
      items: [],
    });
  } else if (billIncomplete.length > 1) {
    notices.push(summarizeBillIncomplete(billIncomplete));
  }

  notices.push(...collapseRest(rest));
  return notices;
}

function summarizeBillIncomplete(issues: ValidationIssue[]): IssueNotice {
  const has = (code: string) => issues.some((issue) => issue.code === code);
  const items: string[] = [];

  if (has("bill.pdf_missing")) {
    items.push("PDF del recibo");
  }

  const totals = [
    has("bill.water_missing") ? "agua" : null,
    has("bill.sewer_missing") ? "alcantarillado" : null,
    has("bill.energy_missing") ? "energía" : null,
  ].filter((item): item is string => Boolean(item));
  if (totals.length > 0) {
    items.push(`Consumos totales (${joinSpanish(totals)})`);
  }

  const chargeIssues = issues.filter((issue) => issue.code === "bill.charge_missing");
  if (chargeIssues.length === 1) {
    items.push(chargeIssues[0].message.replace(/^Falta el importe de /, "").replace(/\.$/, ""));
  } else if (chargeIssues.length > 1) {
    items.push(`${chargeIssues.length} importes en pesos`);
  }

  if (has("bill.other_services_ap_missing")) {
    items.push("Subtotal de otros servicios + AP");
  }

  return {
    severity: "error",
    title: "El recibo aún no está completo. Completa esto en el formulario:",
    items,
  };
}

function collapseRest(issues: ValidationIssue[]): IssueNotice[] {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return [...collapseBySeverity(errors, "error"), ...collapseBySeverity(warnings, "warning")];
}

function collapseBySeverity(
  issues: ValidationIssue[],
  severity: IssueSeverity,
): IssueNotice[] {
  if (issues.length <= 3) {
    return issues.map((issue) => ({
      severity: issue.severity,
      title: issue.message,
      items: [],
    }));
  }

  return [
    {
      severity,
      title:
        severity === "error"
          ? `Hay ${issues.length} problemas. Revisa el contenido de esta sección.`
          : `Hay ${issues.length} avisos. Revisa el contenido de esta sección.`,
      items: issues.map((issue) => issue.message),
    },
  ];
}

function joinSpanish(items: string[]): string {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} y ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}
