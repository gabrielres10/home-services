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
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PHOTOS_BUCKET, readingPhotoPath } from "@/lib/storage/paths";

async function attachPhoto(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  readingId: string;
  floorId: string;
  periodId: string;
  serviceId: string;
  userId: string;
  photo: File;
}): Promise<{ error: string } | { photoId: string }> {
  const fileId = crypto.randomUUID();
  const storagePath = readingPhotoPath({
    floorId: input.floorId,
    periodId: input.periodId,
    serviceId: input.serviceId,
    fileId,
  });
  const buffer = Buffer.from(await input.photo.arrayBuffer());
  const { error: uploadError } = await input.supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (uploadError) {
    return { error: `No se pudo guardar la fotografía: ${uploadError.message}` };
  }

  const { data: photo, error: photoError } = await input.supabase
    .from("reading_photos")
    .insert({
      reading_id: input.readingId,
      storage_path: storagePath,
      uploaded_by: input.userId,
    })
    .select("id")
    .single();

  if (photoError || !photo) {
    return { error: photoError?.message ?? "No se pudo registrar la fotografía." };
  }

  const { error: updateError } = await input.supabase
    .from("meter_readings")
    .update({ current_photo_id: photo.id })
    .eq("id", input.readingId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { photoId: photo.id };
}

export async function submitReading(formData: FormData): Promise<{ error: string } | void> {
  const user = await requireUser();
  const periodId = String(formData.get("period_id") ?? "");
  const floorId = String(formData.get("floor_id") ?? "");
  const serviceId = String(formData.get("service_id") ?? "");
  const rawValue = String(formData.get("value") ?? "");
  const readingDate = String(formData.get("reading_date") ?? "");
  const photo = formData.get("photo");

  const supabase = await createServerSupabaseClient();
  const catalog = await loadCatalog();
  const meter = catalog.meters.find(
    (item) => item.floorId === floorId && item.serviceId === serviceId,
  );
  const service = catalog.services.find((item) => item.id === serviceId);

  const { data: period } = await supabase
    .from("billing_periods")
    .select("*")
    .eq("id", periodId)
    .maybeSingle();

  if (!period) {
    return { error: "El período no existe." };
  }

  const { data: existing } = await supabase
    .from("meter_readings")
    .select("*")
    .eq("period_id", periodId)
    .eq("floor_id", floorId)
    .eq("service_id", serviceId)
    .maybeSingle();

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

  let readingId = existing?.id;
  if (!existing) {
    const { data: inserted, error } = await supabase
      .from("meter_readings")
      .insert({
        period_id: periodId,
        floor_id: floorId,
        service_id: serviceId,
        submitted_value: parsed.value,
        submitted_by: user.id,
        submitted_at: now,
        value: parsed.value,
        reading_date: readingDateValue,
        status: "pending",
        rejection_reason: null,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      if (error?.code === "23505") {
        return { error: "Ya existe una lectura para este piso, servicio y período." };
      }
      return { error: error?.message ?? "No se pudo guardar la lectura." };
    }
    readingId = inserted.id;
  } else {
    const { error } = await supabase
      .from("meter_readings")
      .update({
        submitted_value: existing.submitted_value,
        submitted_by: user.id,
        submitted_at: now,
        value: parsed.value,
        reading_date: readingDateValue,
        status: "pending",
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq("id", existing.id);
    if (error) {
      return { error: error.message };
    }
  }

  if (!readingId) {
    return { error: "No se pudo identificar la lectura." };
  }

  if (photo instanceof File && photo.size > 0) {
    const attached = await attachPhoto({
      supabase,
      readingId,
      floorId,
      periodId,
      serviceId,
      userId: user.id,
      photo,
    });
    if ("error" in attached) {
      return attached;
    }
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

  const supabase = await createServerSupabaseClient();
  const { data: reading } = await supabase
    .from("meter_readings")
    .select("*")
    .eq("id", readingId)
    .maybeSingle();

  if (!reading) {
    return { error: "No se encontró la lectura." };
  }

  const { data: period } = await supabase
    .from("billing_periods")
    .select("*")
    .eq("id", reading.period_id)
    .maybeSingle();
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

  const { error } = await supabase
    .from("meter_readings")
    .update({
      value: nextValue,
      status: "approved",
      rejection_reason: null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      corrected_by: correctedBy,
      corrected_at: correctedAt,
    })
    .eq("id", readingId);

  if (error) {
    return { error: error.message };
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

  const supabase = await createServerSupabaseClient();
  const { data: reading } = await supabase
    .from("meter_readings")
    .select("*")
    .eq("id", readingId)
    .maybeSingle();

  if (!reading) {
    return { error: "No se encontró la lectura." };
  }

  const { data: period } = await supabase
    .from("billing_periods")
    .select("status")
    .eq("id", reading.period_id)
    .maybeSingle();
  if (!period) {
    return { error: "La lectura no tiene período." };
  }
  if (!canSubmitInPeriod(period.status)) {
    return { error: "El período no está abierto. Reábrelo para revisar lecturas." };
  }

  const { error } = await supabase
    .from("meter_readings")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", readingId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/periodos/${reading.period_id}`);
  revalidatePath("/admin");
  revalidatePath("/mis-lecturas");
}
