"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { submitReading } from "@/app/actions/readings";
import { optimizeMeterPhoto } from "@/lib/images/optimize";
import { previousReadingDisplay } from "@/lib/format";
import { Amount } from "@/components/amount";
import { NumericInput } from "@/components/numeric-input";
import type { ValidationIssue } from "@/lib/domain/types";
import { IssueList } from "@/components/issue-list";
import { PhotoPicker } from "@/components/photo-picker";
import { SubmitButton } from "@/components/submit-button";

export function ReadingForm({
  periodId,
  floorId,
  floorName,
  serviceId,
  serviceName,
  unit,
  previousValue,
  currentValue,
  readingDate,
  issues,
  disabled,
  photoRequired = true,
  isOpeningPeriod = false,
  existingPhotoUrl = null,
}: {
  periodId: string;
  floorId: string;
  floorName: string;
  serviceId: string;
  serviceName: string;
  unit: string;
  previousValue: number | null;
  currentValue: string;
  readingDate: string;
  issues: ValidationIssue[];
  disabled: boolean;
  photoRequired?: boolean;
  isOpeningPeriod?: boolean;
  existingPhotoUrl?: string | null;
}) {
  const [pendingPhoto, setPendingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const displayPhoto = previewUrl ?? existingPhotoUrl;

  async function action(formData: FormData) {
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
    <ActionForm action={action} className="stack-md">
      <input type="hidden" name="period_id" value={periodId} />
      <input type="hidden" name="floor_id" value={floorId} />
      <input type="hidden" name="service_id" value={serviceId} />
      {displayPhoto ? (
        <figure className="review-photo">
          {/* URL firmada o vista previa local: next/image no aplica. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayPhoto}
            alt={`Fotografía del contador de ${serviceName} en ${floorName}`}
          />
        </figure>
      ) : null}
      <p className="muted text-[0.86rem]">
        {floorName} · {serviceName} ({unit})
      </p>
      <p className="period-name-preview">
        <span className="kicker">Lectura anterior</span>
        <strong className={previousValue === null ? "type-display-placeholder" : undefined}>
          {previousValue === null ? (
            previousReadingDisplay(previousValue, isOpeningPeriod)
          ) : (
            <Amount value={previousValue} />
          )}
        </strong>
      </p>
      <IssueList issues={issues} />
      <fieldset disabled={disabled || pendingPhoto} className="stack-md border-0 p-0">
        <label className="field">
          <span className="field-label">Lectura actual</span>
          <NumericInput name="value" required defaultValue={currentValue} />
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
          required={photoRequired}
          onPreviewChange={setPreviewUrl}
        />
        <SubmitButton busy={pendingPhoto} pendingLabel="Preparando imagen…">
          Enviar lectura
        </SubmitButton>
      </fieldset>
    </ActionForm>
  );
}
