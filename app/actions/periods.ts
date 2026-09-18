"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current-user";
import { periodLabelFromDates } from "@/lib/domain/period-label";
import { evaluatePeriodReadiness } from "@/lib/domain/period-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadCatalog, loadPreviousBySlots, hasAnyEarlierPeriod } from "@/lib/data/catalog";
import { buildPeriodConsumptions } from "@/lib/domain/period-consumption";
import { billChargeValuesFromRows } from "@/lib/domain/bill-charges";
import { validateBill } from "@/lib/domain/validation";
import { toNumber } from "@/lib/format";

export async function createPeriod(formData: FormData): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  const startsOn = String(formData.get("starts_on") ?? "");
  const endsOn = String(formData.get("ends_on") ?? "");

  if (!startsOn || !endsOn) {
    return { error: "Completa las fechas inicial y final del período." };
  }
  if (startsOn > endsOn) {
    return { error: "La fecha inicial no puede ser posterior a la fecha final." };
  }

  const label = periodLabelFromDates(startsOn, endsOn);
  if (!label) {
    return { error: "Las fechas del período no son válidas." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("billing_periods")
    .insert({
      label,
      starts_on: startsOn,
      ends_on: endsOn,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un período con esas fechas." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin");
  redirect(`/admin/periodos/${data.id}`);
}

export async function markPeriodReady(periodId: string): Promise<{ error: string } | void> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data: period, error: periodError } = await supabase
    .from("billing_periods")
    .select("*")
    .eq("id", periodId)
    .single();

  if (periodError || !period) {
    return { error: "No se encontró el período." };
  }
  if (period.status !== "open") {
    return { error: "Solo un período abierto puede marcarse como listo." };
  }

  const catalog = await loadCatalog();
  const { data: readings } = await supabase
    .from("meter_readings")
    .select("*")
    .eq("period_id", periodId);
  const { data: bill } = await supabase
    .from("bills")
    .select("*")
    .eq("period_id", periodId)
    .maybeSingle();
  const { data: billTotals } = bill
    ? await supabase.from("bill_service_totals").select("*").eq("bill_id", bill.id)
    : { data: [] as Array<{ service_id: string; total_consumption: number }> };
  const { data: billCharges } = bill
    ? await supabase.from("bill_service_charges").select("*").eq("bill_id", bill.id)
    : { data: [] as Array<{ service_id: string; charge_code: string; amount: number }> };

  const totals = (billTotals ?? []).map((row) => ({
    serviceId: row.service_id,
    total: Number(row.total_consumption),
  }));

  const previousBySlot = await loadPreviousBySlots({
    slots: catalog.meters,
    currentPeriodStartsOn: period.starts_on,
  });

  const isOpeningPeriod = !(await hasAnyEarlierPeriod(period.starts_on));
  const consumptions = buildPeriodConsumptions({
    floors: catalog.floors,
    services: catalog.services,
    meters: catalog.meters,
    totals,
    currentReadings: (readings ?? []).map((row) => ({
      floorId: row.floor_id,
      serviceId: row.service_id,
      value: Number(row.value),
      status: row.status,
    })),
    previousBySlot,
    isOpeningPeriod,
  });

  const totalsByCode = new Map(
    (billTotals ?? []).map((row) => {
      const service = catalog.services.find((item) => item.id === row.service_id);
      return [service?.code ?? "", Number(row.total_consumption)] as const;
    }),
  );

  const billIssues = validateBill({
    energy: totalsByCode.get("energia") ?? null,
    water: totalsByCode.get("agua") ?? null,
    sewer: totalsByCode.get("alcantarillado") ?? null,
    hasPdf: Boolean(bill?.pdf_storage_path),
    charges: billChargeValuesFromRows(catalog.services, billCharges ?? []),
    otherServicesApSubtotal: toNumber(bill?.other_services_ap_subtotal ?? null),
  });

  const readiness = evaluatePeriodReadiness({
    expectedCount: catalog.meters.length,
    approvedCount: (readings ?? []).filter((row) => row.status === "approved").length,
    billComplete: billIssues.filter((issue) => issue.severity === "error").length === 0,
    allMeteredConsumptionsCalculable: consumptions.allMeteredCalculable,
    hasNegativeUnmetered: consumptions.hasNegativeUnmetered,
    isOpeningPeriod,
  });

  if (!readiness.ready) {
    return { error: readiness.blockers.map((item) => item.message).join(" ") };
  }

  const { error } = await supabase
    .from("billing_periods")
    .update({ status: "ready" })
    .eq("id", periodId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/periodos/${periodId}`);
}

export async function reopenPeriod(periodId: string): Promise<{ error: string } | void> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("billing_periods")
    .update({ status: "open" })
    .eq("id", periodId)
    .eq("status", "ready");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/periodos/${periodId}`);
}

