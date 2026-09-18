import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BILLS_BUCKET, PHOTOS_BUCKET } from "@/lib/storage/paths";
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
  validateBillTotals,
  validateReadingDraft,
} from "@/lib/domain/validation";
import { toNumber } from "@/lib/format";
import type { ValidationIssue } from "@/lib/domain/types";

export async function signedUrl(bucket: string, path: string | null) {
  if (!path) {
    return null;
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);
  if (error) {
    return null;
  }
  return data.signedUrl;
}

export async function loadPeriodList() {
  const supabase = await createServerSupabaseClient();
  const catalog = await loadCatalog();
  const { data: periods, error } = await supabase
    .from("billing_periods")
    .select("*")
    .order("starts_on", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const { data: readings, error: readingsError } = await supabase
    .from("meter_readings")
    .select("period_id, status");
  if (readingsError) {
    throw new Error(readingsError.message);
  }

  return (periods ?? []).map((period) => {
    const periodReadings = (readings ?? []).filter(
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
  const supabase = await createServerSupabaseClient();
  const catalog = await loadCatalog();

  const { data: period, error } = await supabase
    .from("billing_periods")
    .select("*")
    .eq("id", periodId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!period) {
    return null;
  }

  const [{ data: bill }, { data: readings }, { data: photos }, { data: audits }] =
    await Promise.all([
      supabase.from("bills").select("*").eq("period_id", periodId).maybeSingle(),
      supabase.from("meter_readings").select("*").eq("period_id", periodId),
      supabase.from("reading_photos").select("*"),
      supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "meter_reading")
        .order("occurred_at", { ascending: false })
        .limit(50),
    ]);

  const { data: billTotals } = bill
    ? await supabase.from("bill_service_totals").select("*").eq("bill_id", bill.id)
    : { data: [] };

  const previousBySlot = await loadPreviousBySlots({
    slots: catalog.meters,
    currentPeriodStartsOn: period.starts_on,
  });
  const earlierPeriodExists = await hasAnyEarlierPeriod(period.starts_on);

  const totals = (billTotals ?? []).map((row) => ({
    serviceId: row.service_id,
    total: Number(row.total_consumption),
  }));

  const currentReadings = (readings ?? []).map((row) => ({
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
    const total = (billTotals ?? []).find((row) => row.service_id === service.id);
    totalsByCode.set(service.code, total ? Number(total.total_consumption) : null);
  }

  const billIssues = validateBillTotals({
    energy: totalsByCode.get("energia") ?? null,
    water: totalsByCode.get("agua") ?? null,
    sewer: totalsByCode.get("alcantarillado") ?? null,
    hasPdf: Boolean(bill?.pdf_storage_path),
  });

  const pdfUrl = await signedUrl(BILLS_BUCKET, bill?.pdf_storage_path ?? null);

  const readingCards = await Promise.all(
    catalog.meters.map(async (meter) => {
      const floor = catalog.floors.find((item) => item.id === meter.floorId);
      const service = catalog.services.find((item) => item.id === meter.serviceId);
      const reading = (readings ?? []).find(
        (row) => row.floor_id === meter.floorId && row.service_id === meter.serviceId,
      );
      const previous =
        previousBySlot.find(
          (item) => item.floorId === meter.floorId && item.serviceId === meter.serviceId,
        )?.value ?? null;
      const photo = reading
        ? (photos ?? []).find((item) => item.id === reading.current_photo_id)
        : undefined;
      const photoUrl = await signedUrl(PHOTOS_BUCKET, photo?.storage_path ?? null);
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
        ? (audits ?? []).filter((item) => item.entity_id === reading.id)
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
    submittedCount: (readings ?? []).length,
    approvedCount: (readings ?? []).filter((row) => row.status === "approved").length,
    pendingCount: (readings ?? []).filter((row) => row.status === "pending").length,
    rejectedCount: (readings ?? []).filter((row) => row.status === "rejected").length,
  });

  const readiness = evaluatePeriodReadiness({
    expectedCount: catalog.meters.length,
    approvedCount: counts.approvedCount,
    billComplete: billIssues.filter((issue) => issue.severity === "error").length === 0,
    allMeteredConsumptionsCalculable: consumptions.allMeteredCalculable,
    hasNegativeUnmetered: consumptions.hasNegativeUnmetered,
    isOpeningPeriod,
  });

  return {
    period,
    catalog,
    bill,
    billIssues,
    pdfUrl,
    totalsByCode,
    readingCards,
    consumptions,
    counts,
    readiness,
    isOpeningPeriod,
    statusLabel: periodStatusLabel(period.status),
  };
}

export function numericOrEmpty(value: number | null | undefined): string {
  const parsed = toNumber(value ?? null);
  return parsed === null ? "" : String(parsed);
}
