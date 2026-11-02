"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current-user";
import { periodLabelFromDates } from "@/lib/domain/period-label";
import { periodDeleteConfirmationError } from "@/lib/domain/period-delete";
import { evaluatePeriodReadiness, nextReopenStatus } from "@/lib/domain/period-status";
import {
  UNIQUE_VIOLATION,
  db,
  dbErrorCode,
  dbErrorMessage,
  transaction,
} from "@/lib/db/pool";
import type {
  BillRow,
  BillServiceChargeRow,
  BillServiceTotalRow,
  BillingPeriodRow,
  MeterReadingRow,
} from "@/lib/db/types";
import { loadCatalog, loadPreviousBySlots, hasAnyEarlierPeriod } from "@/lib/data/catalog";
import { loadPeriodDetail } from "@/lib/data/period-detail";
import { buildPeriodConsumptions } from "@/lib/domain/period-consumption";
import { billChargeValuesFromRows } from "@/lib/domain/bill-charges";
import { validateBill } from "@/lib/domain/validation";
import { toNumber } from "@/lib/format";
import { isUuid } from "@/lib/domain/ids";
import { deleteFiles, deleteFolder } from "@/lib/storage/files";
import { BILLS_BUCKET, PHOTOS_BUCKET } from "@/lib/storage/paths";

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

  let periodId: string;
  try {
    const created = await transaction(admin.id, (tx) =>
      tx.queryOne<{ id: string }>(
        `insert into billing_periods (label, starts_on, ends_on, created_by)
         values ($1, $2, $3, $4)
         returning id`,
        [label, startsOn, endsOn, admin.id],
      ),
    );
    if (!created) {
      return { error: "No se pudo crear el período." };
    }
    periodId = created.id;
  } catch (error) {
    if (dbErrorCode(error) === UNIQUE_VIOLATION) {
      return { error: "Ya existe un período con esas fechas." };
    }
    return { error: dbErrorMessage(error) };
  }

  revalidatePath("/admin");
  redirect(`/admin/periodos/${periodId}`);
}

export async function markPeriodReady(periodId: string): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  if (!isUuid(periodId)) {
    return { error: "No se encontró el período." };
  }

  const period = await db.queryOne<BillingPeriodRow>(
    "select * from billing_periods where id = $1",
    [periodId],
  );
  if (!period) {
    return { error: "No se encontró el período." };
  }
  if (period.status !== "open") {
    return { error: "Solo un período abierto puede marcarse como listo." };
  }

  const catalog = await loadCatalog();
  const readings = await db.query<MeterReadingRow>(
    "select * from meter_readings where period_id = $1",
    [periodId],
  );
  const bill = await db.queryOne<BillRow>("select * from bills where period_id = $1", [
    periodId,
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

  const totals = billTotals.map((row) => ({
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
    currentReadings: readings.map((row) => ({
      floorId: row.floor_id,
      serviceId: row.service_id,
      value: Number(row.value),
      status: row.status,
    })),
    previousBySlot,
    isOpeningPeriod,
  });

  const totalsByCode = new Map(
    billTotals.map((row) => {
      const service = catalog.services.find((item) => item.id === row.service_id);
      return [service?.code ?? "", Number(row.total_consumption)] as const;
    }),
  );

  const billIssues = validateBill({
    energy: totalsByCode.get("energia") ?? null,
    water: totalsByCode.get("agua") ?? null,
    sewer: totalsByCode.get("alcantarillado") ?? null,
    hasPdf: Boolean(bill?.pdf_storage_path),
    charges: billChargeValuesFromRows(catalog.services, billCharges),
    otherServicesApSubtotal: toNumber(bill?.other_services_ap_subtotal ?? null),
  });

  const readiness = evaluatePeriodReadiness({
    expectedCount: catalog.meters.length,
    approvedCount: readings.filter((row) => row.status === "approved").length,
    billComplete: billIssues.filter((issue) => issue.severity === "error").length === 0,
    allMeteredConsumptionsCalculable: consumptions.allMeteredCalculable,
    hasNegativeUnmetered: consumptions.hasNegativeUnmetered,
    isOpeningPeriod,
  });

  if (!readiness.ready) {
    return { error: readiness.blockers.map((item) => item.message).join(" ") };
  }

  try {
    await transaction(admin.id, (tx) =>
      tx.query("update billing_periods set status = 'ready' where id = $1", [periodId]),
    );
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/periodos/${periodId}`);
}

export async function closePeriod(periodId: string): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  const detail = await loadPeriodDetail(periodId);
  if (!detail) {
    return { error: "No se encontró el período." };
  }
  if (detail.period.status !== "ready") {
    return { error: "Solo un período listo puede cerrarse." };
  }
  if (!detail.isOpeningPeriod && !detail.settlement) {
    return {
      error:
        detail.settlementUnavailableMessage ??
        "No se puede liquidar este período. Completa el recibo y los consumos.",
    };
  }

  try {
    await transaction(admin.id, (tx) =>
      tx.query("update billing_periods set status = 'closed' where id = $1 and status = 'ready'", [
        periodId,
      ]),
    );
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/periodos/${periodId}`);
}

export async function reopenPeriod(periodId: string): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  if (!isUuid(periodId)) {
    return { error: "No se encontró el período." };
  }

  const period = await db.queryOne<Pick<BillingPeriodRow, "status">>(
    "select status from billing_periods where id = $1",
    [periodId],
  );
  if (!period) {
    return { error: "No se encontró el período." };
  }

  const nextStatus = nextReopenStatus(period.status);
  if (!nextStatus) {
    return { error: "Este período no se puede reabrir." };
  }

  try {
    await transaction(admin.id, (tx) =>
      tx.query("update billing_periods set status = $2 where id = $1 and status = $3", [
        periodId,
        nextStatus,
        period.status,
      ]),
    );
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/periodos/${periodId}`);
}

export async function deletePeriod(formData: FormData): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  const periodId = String(formData.get("period_id") ?? "").trim();
  if (!isUuid(periodId)) {
    return { error: "No se encontró el período." };
  }

  const period = await db.queryOne<Pick<BillingPeriodRow, "id" | "label">>(
    "select id, label from billing_periods where id = $1",
    [periodId],
  );
  if (!period) {
    return { error: "No se encontró el período." };
  }

  const blocked = periodDeleteConfirmationError({
    confirmed: String(formData.get("confirm_delete") ?? "") === "on",
    typedLabel: String(formData.get("confirm_label") ?? ""),
    periodLabel: period.label,
  });
  if (blocked) {
    return { error: blocked };
  }

  try {
    // Archivos, lecturas y período se borran juntos: o todo o nada.
    await transaction(admin.id, async (tx) => {
      const photos = await tx.query<{ storage_path: string }>(
        `select p.storage_path
         from reading_photos p
         join meter_readings r on r.id = p.reading_id
         where r.period_id = $1`,
        [periodId],
      );

      await deleteFolder(tx, BILLS_BUCKET, periodId);
      await deleteFiles(
        tx,
        PHOTOS_BUCKET,
        photos.map((row) => row.storage_path),
      );
      await tx.query("update meter_readings set current_photo_id = null where period_id = $1", [
        periodId,
      ]);
      await tx.query("delete from billing_periods where id = $1", [periodId]);
    });
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath("/mis-lecturas");
  revalidatePath(`/admin/periodos/${periodId}`);
  redirect("/admin");
}
