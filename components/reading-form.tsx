"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { submitReading } from "@/app/actions/readings";
import { optimizeMeterPhoto } from "@/lib/images/optimize";
import { previousReadingDisplay } from "@/lib/format";
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
}) {
  const [pendingPhoto, setPendingPhoto] = useState(false);

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
      <p className="muted text-[0.86rem]">
        {floorName} · {serviceName} ({unit})
      </p>
      <p className="period-name-preview">
        <span className="kicker">Lectura anterior</span>
        <strong className={previousValue === null ? "type-display-placeholder" : undefined}>
          {previousReadingDisplay(previousValue, isOpeningPeriod)}
        </strong>
      </p>
      <IssueList issues={issues} />
      <fieldset disabled={disabled || pendingPhoto} className="stack-md border-0 p-0">
        <label className="field">
          <span className="field-label">Lectura actual</span>
          <input
            name="value"
            inputMode="decimal"
            required
            defaultValue={currentValue}
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
          required={photoRequired}
          alt={`Vista previa del contador de ${serviceName} en ${floorName}`}
        />
        <SubmitButton busy={pendingPhoto} pendingLabel="Preparando imagen…">
          Enviar lectura
        </SubmitButton>
      </fieldset>
    </ActionForm>
  );
}
