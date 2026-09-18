"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { approveReading, rejectReading, submitReading } from "@/app/actions/readings";
import { optimizeMeterPhoto } from "@/lib/images/optimize";
import { consumptionDisplay, formatNumber, previousReadingDisplay } from "@/lib/format";
import { IssueList } from "@/components/issue-list";
import { ReadingStatusBadge, MissingBadge } from "@/components/status-badge";
import { PhotoPicker } from "@/components/photo-picker";
import { SubmitButton } from "@/components/submit-button";
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
  isOpeningPeriod = false,
  locked = false,
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
  isOpeningPeriod?: boolean;
  locked?: boolean;
}) {
  const [pendingPhoto, setPendingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const displayPhoto = previewUrl ?? photoUrl;

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
    <section className="review-card">
      <div className="review-head flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="section-title text-[1.35rem]">{serviceName}</h3>
        <div className="flex items-center gap-3">
          {status ? <ReadingStatusBadge status={status} /> : <MissingBadge />}
          <span className="kicker">{unit}</span>
        </div>
      </div>

      {displayPhoto ? (
        <figure className="review-photo">
          {/* URL firmada o vista previa local: next/image no aplica. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayPhoto}
            alt={`Fotografía del contador de ${serviceName} en ${floorName}`}
          />
          {previewUrl ? null : (
            <figcaption>Compara visualmente la fotografía con la lectura declarada.</figcaption>
          )}
        </figure>
      ) : (
        <p className="review-photo notice notice-error">No hay fotografía.</p>
      )}

      <div className="review-data stack-md">
        <dl className="review-stats">
          <div>
            <dt>Lectura anterior</dt>
            <dd>{previousReadingDisplay(previousValue, isOpeningPeriod)}</dd>
          </div>
          <div>
            <dt>Lectura actual</dt>
            <dd>{value === null ? "—" : formatNumber(value)}</dd>
          </div>
          <div>
            <dt>Valor enviado por el usuario</dt>
            <dd>{submittedValue === null ? "—" : formatNumber(submittedValue)}</dd>
          </div>
          <div>
            <dt>Consumo</dt>
            <dd>{consumptionDisplay(consumption, isOpeningPeriod)}</dd>
          </div>
        </dl>
        <IssueList issues={issues} />
        {rejectionReason ? (
          <p className="notice notice-error">Motivo de rechazo: {rejectionReason}</p>
        ) : null}
      </div>

      {locked ? (
        <p className="review-actions muted text-[0.92rem]">
          El período no está abierto. Reábrelo para aprobar o corregir lecturas.
        </p>
      ) : readingId ? (
        <div className="review-actions">
          <ActionForm action={approveReading} className="stack-md">
            <input type="hidden" name="reading_id" value={readingId} />
            <label className="field">
              <span className="field-label">Corregir valor (opcional)</span>
              <input
                name="corrected_value"
                inputMode="decimal"
                defaultValue={value === null ? "" : String(value)}
                className="input-control input-figure"
              />
            </label>
            {warningsNeedConfirm ? (
              <label className="flex items-start gap-2 text-[0.9rem]">
                <input type="checkbox" name="confirm_warnings" className="mt-1 accent-forest" />
                <span>Revisé los avisos y confirmo la aprobación.</span>
              </label>
            ) : null}
            <SubmitButton variant="approve">Aprobar</SubmitButton>
          </ActionForm>
          <ActionForm action={rejectReading} className="stack-md">
            <input type="hidden" name="reading_id" value={readingId} />
            <label className="field">
              <span className="field-label">Motivo de rechazo o corrección</span>
              <textarea
                name="rejection_reason"
                required
                rows={3}
                className="input-control"
              />
            </label>
            <SubmitButton variant="reject">Rechazar / solicitar corrección</SubmitButton>
          </ActionForm>
        </div>
      ) : (
        <ActionForm action={adminSubmit} className="review-actions stack-md">
          <input type="hidden" name="period_id" value={periodId} />
          <input type="hidden" name="floor_id" value={floorId} />
          <input type="hidden" name="service_id" value={serviceId} />
          <p className="muted text-[0.92rem]">
            Este contador aún no tiene lectura. Escríbela tú y sube la foto.
          </p>
          <label className="field">
            <span className="field-label">Lectura actual</span>
            <input
              name="value"
              inputMode="decimal"
              required
              className="input-control input-figure"
            />
          </label>
          <label className="field">
            <span className="field-label">Fecha de lectura</span>
            <input
              name="reading_date"
              type="date"
              required
              defaultValue={readingDate}
              className="input-control"
            />
          </label>
          <PhotoPicker
            title="Foto del contador"
            onPreviewChange={setPreviewUrl}
          />
          <SubmitButton busy={pendingPhoto} pendingLabel="Preparando imagen…">
            Registrar
          </SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}
