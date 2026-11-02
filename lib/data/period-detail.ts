import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db/pool";
import type {
  AuditLogRow,
  BillRow,
  BillServiceChargeRow,
  BillServiceTotalRow,
  BillingPeriodRow,
  MeterReadingRow,
  ReadingPhotoRow,
} from "@/lib/db/types";
import { billPdfUrl, readingPhotoUrl } from "@/lib/storage/paths";
import {
  hasAnyEarlierPeriod,
  loadCatalog,
  loadPreviousBySlots,
} from "@/lib/data/catalog";
import { buildPeriodConsumptions } from "@/lib/domain/period-consumption";
import {
  countPeriodReadings,
  evaluatePeriodReadiness,
  periodStatusLabel,
} from "@/lib/domain/period-status";
import {
  currentLessThanPreviousIssue,
  previousReadingIssue,
  validateBill,
  validateReadingDraft,
} from "@/lib/domain/validation";
import { toNumber, numberToInputRaw } from "@/lib/format";
import type { ValidationIssue } from "@/lib/domain/types";
import { billChargeValuesFromRows } from "@/lib/domain/bill-charges";
import { resolveSettlement } from "@/lib/domain/settlement";
import { isUuid } from "@/lib/domain/ids";

export async function loadPeriodList() {
  await requireAdmin();
  const catalog = await loadCatalog();
  const [periods, readings] = await Promise.all([
    db.query<BillingPeriodRow>("select * from billing_periods order by starts_on desc"),
    db.query<Pick<MeterReadingRow, "period_id" | "status">>(
      "select period_id, status from meter_readings",
    ),
  ]);

  return periods.map((period) => {
    const periodReadings = readings.filter(
      (row) => row.period_id === period.id,
    );
    const counts = countPeriodReadings({
      expectedCount: catalog.meters.length,
      submittedCount: periodReadings.length,
      approvedCount: periodReadings.filter((row) => row.status === "approved").length,
      pendingCount: periodReadings.filter((row) => row.status === "pending").length,
      rejectedCount: periodReadings.filter((row) => row.status === "rejected").length,
    });
    return {
      ...period,
      counts,
      statusLabel: periodStatusLabel(period.status),
    };
  });
}

export async function loadPeriodDetail(periodId: string) {
  await requireAdmin();
  if (!isUuid(periodId)) {
    return null;
  }
  const catalog = await loadCatalog();

  const period = await db.queryOne<BillingPeriodRow>(
    "select * from billing_periods where id = $1",
    [periodId],
  );
  if (!period) {
    return null;
  }

  const [bill, readings, photos, audits] = await Promise.all([
    db.queryOne<BillRow>("select * from bills where period_id = $1", [periodId]),
    db.query<MeterReadingRow>("select * from meter_readings where period_id = $1", [periodId]),
    db.query<ReadingPhotoRow>(
      `select p.*
       from reading_photos p
       join meter_readings r on r.id = p.reading_id
       where r.period_id = $1`,
      [periodId],
    ),
    db.query<AuditLogRow>(
      `select * from audit_logs
       where entity_type = 'meter_reading'
       order by occurred_at desc
       limit 50`,
    ),
  ]);

  const billTotals = bill
    ? await db.query<BillServiceTotalRow>(
        "select * from bill_service_totals where bill_id = $1",
        [bill.id],
      )
    : [];
  const billCharges = bill
    ? await db.query<BillServiceChargeRow>(
        "select * from bill_service_charges where bill_id = $1",
        [bill.id],
      )
    : [];

  const previousBySlot = await loadPreviousBySlots({
    slots: catalog.meters,
    currentPeriodStartsOn: period.starts_on,
  });
  const earlierPeriodExists = await hasAnyEarlierPeriod(period.starts_on);

  const totals = billTotals.map((row) => ({
    serviceId: row.service_id,
    total: Number(row.total_consumption),
  }));

  const currentReadings = readings.map((row) => ({
    floorId: row.floor_id,
    serviceId: row.service_id,
    value: Number(row.value),
    status: row.status,
  }));

  const isOpeningPeriod = !earlierPeriodExists;
  const consumptions = buildPeriodConsumptions({
    floors: catalog.floors,
    services: catalog.services,
    meters: catalog.meters,
    totals,
    currentReadings,
    previousBySlot,
    isOpeningPeriod,
  });

  const totalsByCode = new Map<string, number | null>();
  for (const service of catalog.services) {
    const total = billTotals.find((row) => row.service_id === service.id);
    totalsByCode.set(service.code, total ? Number(total.total_consumption) : null);
  }

  const chargeValues = billChargeValuesFromRows(catalog.services, billCharges);

  const billIssues = validateBill({
    energy: totalsByCode.get("energia") ?? null,
    water: totalsByCode.get("agua") ?? null,
    sewer: totalsByCode.get("alcantarillado") ?? null,
    hasPdf: Boolean(bill?.pdf_storage_path),
    charges: chargeValues,
    otherServicesApSubtotal: toNumber(bill?.other_services_ap_subtotal ?? null),
  });

  const pdfUrl = bill?.pdf_storage_path ? billPdfUrl(periodId) : null;

  const readingCards = await Promise.all(
    catalog.meters.map(async (meter) => {
      const floor = catalog.floors.find((item) => item.id === meter.floorId);
      const service = catalog.services.find((item) => item.id === meter.serviceId);
      const reading = readings.find(
        (row) => row.floor_id === meter.floorId && row.service_id === meter.serviceId,
      );
      const previous =
        previousBySlot.find(
          (item) => item.floorId === meter.floorId && item.serviceId === meter.serviceId,
        )?.value ?? null;
      const photo = reading
        ? photos.find((item) => item.id === reading.current_photo_id)
        : undefined;
      const photoUrl = photo ? readingPhotoUrl(photo.id) : null;
      const consumptionLine = consumptions.lines.find(
        (line) => line.floorId === meter.floorId && line.serviceId === meter.serviceId,
      );

      const issues: ValidationIssue[] = [];
      if (reading) {
        const less = previous !== null ? currentLessThanPreviousIssue(Number(reading.value), previous) : null;
        if (less) issues.push(less);
        if (!reading.current_photo_id) {
          issues.push({
            code: "reading.photo_missing",
            severity: "error",
            message: "Debe adjuntarse una fotografía del contador.",
          });
        }
        if (previous === null) {
          issues.push(previousReadingIssue(earlierPeriodExists));
        }
      } else {
        issues.push(
          ...validateReadingDraft({
            rawValue: "",
            hasPhoto: false,
            previousApproved: previous,
            hasEarlierPeriod: earlierPeriodExists,
            periodStatus: period.status,
            hasMeter: true,
            serviceAllowed: true,
            alreadyHasApprovedReading: false,
          }).filter((issue) => issue.code !== "reading.empty" && issue.code !== "reading.period_not_open"),
        );
        issues.push({
          code: "reading.missing",
          severity: "error",
          message: "Falta la lectura de este contador.",
        });
      }

      const existingCodes = new Set(issues.map((issue) => issue.code));
      issues.push(
        ...(consumptionLine?.issues ?? []).filter((issue) => !existingCodes.has(issue.code)),
      );

      const readingAudits = reading
        ? audits.filter((item) => item.entity_id === reading.id)
        : [];

      return {
        meter,
        floor,
        service,
        reading,
        previous,
        photoUrl,
        consumption: consumptionLine?.consumption ?? null,
        issues,
        audits: readingAudits,
        warningsNeedConfirm: issues.some(
          (issue) => issue.severity === "warning" && issue.code !== "reading.opening",
        ),
      };
    }),
  );

  const counts = countPeriodReadings({
    expectedCount: catalog.meters.length,
    submittedCount: readings.length,
    approvedCount: readings.filter((row) => row.status === "approved").length,
    pendingCount: readings.filter((row) => row.status === "pending").length,
    rejectedCount: readings.filter((row) => row.status === "rejected").length,
  });

  const readiness = evaluatePeriodReadiness({
    expectedCount: catalog.meters.length,
    approvedCount: counts.approvedCount,
    billComplete: billIssues.filter((issue) => issue.severity === "error").length === 0,
    allMeteredConsumptionsCalculable: consumptions.allMeteredCalculable,
    hasNegativeUnmetered: consumptions.hasNegativeUnmetered,
    isOpeningPeriod,
  });

  const settlementResolution = resolveSettlement({
    periodId: period.id,
    periodLabel: period.label,
    isOpeningPeriod,
    floors: catalog.floors,
    lines: consumptions.lines,
    charges: chargeValues,
    otherServicesAp: toNumber(bill?.other_services_ap_subtotal ?? null),
  });

  return {
    period,
    catalog,
    bill,
    billIssues,
    pdfUrl,
    totalsByCode,
    chargeValues,
    readingCards,
    consumptions,
    counts,
    readiness,
    isOpeningPeriod,
    statusLabel: periodStatusLabel(period.status),
    settlement: settlementResolution.result,
    settlementUnavailableMessage: settlementResolution.unavailableMessage,
  };
}

export function numericOrEmpty(value: number | null | undefined): string {
  const parsed = toNumber(value ?? null);
  return parsed === null ? "" : numberToInputRaw(parsed);
}
