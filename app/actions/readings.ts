"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/current-user";
import { hasAnyEarlierPeriod, loadCatalog, loadPreviousApprovedValue } from "@/lib/data/catalog";
import { canSubmitInPeriod } from "@/lib/domain/period-status";
import { canSubmitReading, canCorrectReading } from "@/lib/domain/permissions";
import { canTransitionReadingStatus, floorUserCanMutate } from "@/lib/domain/reading-states";
import {
  hasBlockingErrors,
  parseReadingValue,
  validateReadingDraft,
} from "@/lib/domain/validation";
import {
  UNIQUE_VIOLATION,
  db,
  dbErrorCode,
  dbErrorMessage,
  transaction,
  type Queryable,
} from "@/lib/db/pool";
import type { BillingPeriodRow, MeterReadingRow } from "@/lib/db/types";
import { isUuid } from "@/lib/domain/ids";
import { putFile } from "@/lib/storage/files";
import {
  MAX_PHOTO_BYTES,
  PHOTOS_BUCKET,
  readingPhotoPath,
} from "@/lib/storage/paths";

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function isJpeg(data: Buffer): boolean {
  return JPEG_SIGNATURE.every((byte, index) => data[index] === byte);
}

async function attachPhoto(input: {
  tx: Queryable;
  readingId: string;
  floorId: string;
  periodId: string;
  serviceId: string;
  userId: string;
  data: Buffer;
}): Promise<void> {
  const storagePath = readingPhotoPath({
    floorId: input.floorId,
    periodId: input.periodId,
    serviceId: input.serviceId,
    fileId: crypto.randomUUID(),
  });
  await putFile(input.tx, {
    bucket: PHOTOS_BUCKET,
    path: storagePath,
    contentType: "image/jpeg",
    data: input.data,
  });

  const photo = await input.tx.queryOne<{ id: string }>(
    `insert into reading_photos (reading_id, storage_path, uploaded_by)
     values ($1, $2, $3)
     returning id`,
    [input.readingId, storagePath, input.userId],
  );
  if (!photo) {
    throw new Error("No se pudo registrar la fotografía.");
  }

  await input.tx.query("update meter_readings set current_photo_id = $1 where id = $2", [
    photo.id,
    input.readingId,
  ]);
}

export async function submitReading(formData: FormData): Promise<{ error: string } | void> {
  const user = await requireUser();
  const periodId = String(formData.get("period_id") ?? "");
  const floorId = String(formData.get("floor_id") ?? "");
  const serviceId = String(formData.get("service_id") ?? "");
  const rawValue = String(formData.get("value") ?? "");
  const readingDate = String(formData.get("reading_date") ?? "");
  const photo = formData.get("photo");

  if (!isUuid(periodId) || !isUuid(floorId) || !isUuid(serviceId)) {
    return { error: "Faltan datos de la lectura." };
  }

  const catalog = await loadCatalog();
  const meter = catalog.meters.find(
    (item) => item.floorId === floorId && item.serviceId === serviceId,
  );
  const service = catalog.services.find((item) => item.id === serviceId);

  const period = await db.queryOne<BillingPeriodRow>(
    "select * from billing_periods where id = $1",
    [periodId],
  );

  if (!period) {
    return { error: "El período no existe." };
  }

  const existing = await db.queryOne<MeterReadingRow>(
    "select * from meter_readings where period_id = $1 and floor_id = $2 and service_id = $3",
    [periodId, floorId, serviceId],
  );

  const previousApproved = await loadPreviousApprovedValue({
    floorId,
    serviceId,
    currentPeriodStartsOn: period.starts_on,
  });
  const hasEarlierPeriod = await hasAnyEarlierPeriod(period.starts_on);
  const hasPhoto =
    (photo instanceof File && photo.size > 0) || Boolean(existing?.current_photo_id);

  const issues = validateReadingDraft({
    rawValue,
    hasPhoto,
    previousApproved,
    hasEarlierPeriod,
    periodStatus: period.status,
    hasMeter: Boolean(meter),
    serviceAllowed: service?.consumptionSource === "metered" && Boolean(meter),
    alreadyHasApprovedReading:
      existing?.status === "approved" && user.role !== "admin",
  });

  if (hasBlockingErrors(issues)) {
    return { error: issues.filter((issue) => issue.severity === "error").map((issue) => issue.message).join(" ") };
  }

  const parsed = parseReadingValue(rawValue);
  if (!parsed.ok) {
    return { error: parsed.issue.message };
  }

  if (
    !canSubmitReading({
      role: user.role,
      actorFloorId: user.floorId,
      readingFloorId: floorId,
      periodOpen: canSubmitInPeriod(period.status),
      readingStatus: existing?.status ?? null,
    })
  ) {
    return { error: "No puedes enviar esta lectura." };
  }

  if (user.role !== "admin" && existing && !floorUserCanMutate(existing.status)) {
    return { error: "Una lectura aprobada no puede modificarse." };
  }

  const now = new Date().toISOString();
  const readingDateValue = readingDate || new Date().toISOString().slice(0, 10);

  let photoData: Buffer | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return { error: "La fotografía no puede superar 5 MB." };
    }
    photoData = Buffer.from(await photo.arrayBuffer());
    if (!isJpeg(photoData)) {
      return { error: "La fotografía debe ser una imagen JPEG." };
    }
  }

  // Lectura y foto se guardan juntas: si algo falla, no queda nada a medias.
  try {
    await transaction(user.id, async (tx) => {
      let readingId = existing?.id;
      if (!existing) {
        const inserted = await tx.queryOne<{ id: string }>(
          `insert into meter_readings
             (period_id, floor_id, service_id, submitted_value, submitted_by,
              submitted_at, value, reading_date, status, rejection_reason)
           values ($1, $2, $3, $4, $5, $6, $4, $7, 'pending', null)
           returning id`,
          [periodId, floorId, serviceId, parsed.value, user.id, now, readingDateValue],
        );
        readingId = inserted?.id;
      } else {
        await tx.query(
          `update meter_readings
           set submitted_by = $2,
               submitted_at = $3,
               value = $4,
               reading_date = $5,
               status = 'pending',
               rejection_reason = null,
               reviewed_by = null,
               reviewed_at = null
           where id = $1`,
          [existing.id, user.id, now, parsed.value, readingDateValue],
        );
      }

      if (!readingId) {
        throw new Error("No se pudo identificar la lectura.");
      }

      if (photoData) {
        await attachPhoto({
          tx,
          readingId,
          floorId,
          periodId,
          serviceId,
          userId: user.id,
          data: photoData,
        });
      }
    });
  } catch (error) {
    if (dbErrorCode(error) === UNIQUE_VIOLATION) {
      return { error: "Ya existe una lectura para este piso, servicio y período." };
    }
    return { error: dbErrorMessage(error) };
  }

  revalidatePath("/mis-lecturas");
  revalidatePath(`/admin/periodos/${periodId}`);
  revalidatePath("/admin");
}

export async function approveReading(formData: FormData): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  const readingId = String(formData.get("reading_id") ?? "");
  const confirmWarnings = String(formData.get("confirm_warnings") ?? "") === "on";
  const correctedRaw = String(formData.get("corrected_value") ?? "").trim();

  if (!isUuid(readingId)) {
    return { error: "No se encontró la lectura." };
  }

  const reading = await db.queryOne<MeterReadingRow>(
    "select * from meter_readings where id = $1",
    [readingId],
  );

  if (!reading) {
    return { error: "No se encontró la lectura." };
  }

  const period = await db.queryOne<BillingPeriodRow>(
    "select * from billing_periods where id = $1",
    [reading.period_id],
  );
  if (!period) {
    return { error: "La lectura no tiene período." };
  }
  if (!canSubmitInPeriod(period.status)) {
    return { error: "El período no está abierto. Reábrelo para revisar lecturas." };
  }

  if (!canCorrectReading(admin.role)) {
    return { error: "No autorizado." };
  }

  if (
    !canTransitionReadingStatus({
      from: reading.status,
      to: "approved",
      role: "admin",
    })
  ) {
    return { error: "No se puede aprobar esta lectura en su estado actual." };
  }

  if (!reading.current_photo_id) {
    return { error: "No se puede aprobar una lectura sin fotografía." };
  }

  const previousApproved = await loadPreviousApprovedValue({
    floorId: reading.floor_id,
    serviceId: reading.service_id,
    currentPeriodStartsOn: period.starts_on,
  });

  let nextValue = Number(reading.value);
  let correctedBy: string | null = reading.corrected_by;
  let correctedAt: string | null = reading.corrected_at;

  if (correctedRaw !== "") {
    const parsed = parseReadingValue(correctedRaw);
    if (!parsed.ok) {
      return { error: parsed.issue.message };
    }
    if (parsed.value !== nextValue) {
      nextValue = parsed.value;
      correctedBy = admin.id;
      correctedAt = new Date().toISOString();
    }
  }

  const warning =
    previousApproved !== null && nextValue < previousApproved
      ? `La lectura actual (${nextValue}) es menor que la anterior (${previousApproved}).`
      : null;

  if (warning && !confirmWarnings) {
    return {
      error:
        `${warning} Confirma que revisaste el aviso antes de aprobar.`,
    };
  }

  try {
    await transaction(admin.id, (tx) =>
      tx.query(
        `update meter_readings
         set value = $2,
             status = 'approved',
             rejection_reason = null,
             reviewed_by = $3,
             reviewed_at = $4,
             corrected_by = $5,
             corrected_at = $6
         where id = $1`,
        [readingId, nextValue, admin.id, new Date().toISOString(), correctedBy, correctedAt],
      ),
    );
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }

  revalidatePath(`/admin/periodos/${reading.period_id}`);
  revalidatePath("/admin");
  revalidatePath("/mis-lecturas");
}

export async function rejectReading(formData: FormData): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  const readingId = String(formData.get("reading_id") ?? "");
  const reason = String(formData.get("rejection_reason") ?? "").trim();

  if (!reason) {
    return { error: "Indica el motivo del rechazo o de la corrección." };
  }

  if (!isUuid(readingId)) {
    return { error: "No se encontró la lectura." };
  }

  const reading = await db.queryOne<MeterReadingRow>(
    "select * from meter_readings where id = $1",
    [readingId],
  );

  if (!reading) {
    return { error: "No se encontró la lectura." };
  }

  const period = await db.queryOne<Pick<BillingPeriodRow, "status">>(
    "select status from billing_periods where id = $1",
    [reading.period_id],
  );
  if (!period) {
    return { error: "La lectura no tiene período." };
  }
  if (!canSubmitInPeriod(period.status)) {
    return { error: "El período no está abierto. Reábrelo para revisar lecturas." };
  }

  try {
    await transaction(admin.id, (tx) =>
      tx.query(
        `update meter_readings
         set status = 'rejected',
             rejection_reason = $2,
             reviewed_by = $3,
             reviewed_at = $4
         where id = $1`,
        [readingId, reason, admin.id, new Date().toISOString()],
      ),
    );
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }

  revalidatePath(`/admin/periodos/${reading.period_id}`);
  revalidatePath("/admin");
  revalidatePath("/mis-lecturas");
}
