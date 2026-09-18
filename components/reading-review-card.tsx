"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { approveReading, rejectReading, submitReading } from "@/app/actions/readings";
import { optimizeMeterPhoto } from "@/lib/images/optimize";
import { formatNumber } from "@/lib/format";
import { IssueList } from "@/components/issue-list";
import { ReadingStatusBadge, MissingBadge } from "@/components/status-badge";
import type { ValidationIssue } from "@/lib/domain/types";
import type { ReadingStatus } from "@/lib/domain/types";

export function ReadingReviewCard({
  periodId,
  floorId,
  floorName,
  serviceId,
  serviceName,
  unit,
  readingId,
  status,
  submittedValue,
  value,
  previousValue,
  consumption,
  photoUrl,
  readingDate,
  rejectionReason,
  issues,
  warningsNeedConfirm,
}: {
  periodId: string;
  floorId: string;
  floorName: string;
  serviceId: string;
  serviceName: string;
  unit: string;
  readingId: string | null;
  status: ReadingStatus | null;
  submittedValue: number | null;
  value: number | null;
  previousValue: number | null;
  consumption: number | null;
  photoUrl: string | null;
  readingDate: string;
  rejectionReason: string | null;
  issues: ValidationIssue[];
  warningsNeedConfirm: boolean;
}) {
  const [pendingPhoto, setPendingPhoto] = useState(false);

  async function adminSubmit(formData: FormData) {
    const file = formData.get("photo");
    if (file instanceof File && file.size > 0) {
      setPendingPhoto(true);
      try {
        const optimized = await optimizeMeterPhoto(file);
        formData.set(
          "photo",
          new File([optimized], "contador.jpg", { type: "image/jpeg" }),
        );
      } finally {
        setPendingPhoto(false);
      }
    }
    return submitReading(formData);
  }

  return (
    <section className="space-y-3 rounded border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-stone-900">
          {floorName} · {serviceName}
        </h3>
        <div className="flex items-center gap-2">
          {status ? <ReadingStatusBadge status={status} /> : <MissingBadge />}
          <span className="text-xs uppercase tracking-wide text-stone-500">{unit}</span>
        </div>
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-stone-500">Lectura anterior</dt>
          <dd>{previousValue === null ? "No hay lectura aprobada previa" : formatNumber(previousValue)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Lectura actual</dt>
          <dd>{value === null ? "—" : formatNumber(value)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Valor enviado por el usuario</dt>
          <dd>{submittedValue === null ? "—" : formatNumber(submittedValue)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Consumo</dt>
          <dd>{consumption === null ? "No calculable todavía" : formatNumber(consumption)}</dd>
        </div>
      </dl>
      <IssueList issues={issues} />
      {rejectionReason ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Motivo de rechazo: {rejectionReason}
        </p>
      ) : null}
      {photoUrl ? (
        <figure className="space-y-1">
          {/* URL firmada y privada: next/image no aplica. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={`Fotografía del contador de ${serviceName} en ${floorName}`}
            className="max-h-[28rem] w-full rounded border border-stone-200 object-contain bg-stone-50"
          />
          <figcaption className="text-xs text-stone-500">
            Compara visualmente la fotografía con la lectura declarada.
          </figcaption>
        </figure>
      ) : (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          No hay fotografía.
        </p>
      )}

      {readingId ? (
        <div className="grid gap-4 border-t border-stone-100 pt-3 lg:grid-cols-2">
          <ActionForm action={approveReading} className="space-y-3">
            <input type="hidden" name="reading_id" value={readingId} />
            <label className="block text-sm">
              <span className="mb-1 block text-stone-700">Corregir valor (opcional)</span>
              <input
                name="corrected_value"
                inputMode="decimal"
                defaultValue={value === null ? "" : String(value)}
                className="w-full rounded border border-stone-300 px-3 py-2"
              />
            </label>
            {warningsNeedConfirm ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirm_warnings" className="mt-1" />
                <span>Revisé los avisos y confirmo la aprobación.</span>
              </label>
            ) : null}
            <button
              type="submit"
              className="rounded bg-green-800 px-4 py-2 text-white hover:bg-green-700"
            >
              Aprobar
            </button>
          </ActionForm>
          <ActionForm action={rejectReading} className="space-y-3">
            <input type="hidden" name="reading_id" value={readingId} />
            <label className="block text-sm">
              <span className="mb-1 block text-stone-700">Motivo de rechazo o corrección</span>
              <textarea
                name="rejection_reason"
                required
                rows={3}
                className="w-full rounded border border-stone-300 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-red-800 px-4 py-2 text-white hover:bg-red-700"
            >
              Rechazar / solicitar corrección
            </button>
          </ActionForm>
        </div>
      ) : (
        <ActionForm action={adminSubmit} className="space-y-3 border-t border-stone-100 pt-3">
          <input type="hidden" name="period_id" value={periodId} />
          <input type="hidden" name="floor_id" value={floorId} />
          <input type="hidden" name="service_id" value={serviceId} />
          <p className="text-sm text-stone-600">Registrar lectura desde administración</p>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-700">Lectura actual</span>
            <input
              name="value"
              inputMode="decimal"
              required
              className="w-full rounded border border-stone-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-700">Fecha de lectura</span>
            <input
              name="reading_date"
              type="date"
              required
              defaultValue={readingDate}
              className="w-full rounded border border-stone-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-700">Fotografía</span>
            <input name="photo" type="file" accept="image/*" required className="block w-full text-sm" />
          </label>
          <button
            type="submit"
            disabled={pendingPhoto}
            className="rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-800"
          >
            {pendingPhoto ? "Preparando imagen…" : "Registrar"}
          </button>
        </ActionForm>
      )}
    </section>
  );
}
