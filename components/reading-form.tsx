"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { submitReading } from "@/app/actions/readings";
import { optimizeMeterPhoto } from "@/lib/images/optimize";
import { previousReadingDisplay } from "@/lib/format";
import type { ValidationIssue } from "@/lib/domain/types";
import { IssueList } from "@/components/issue-list";

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
    <ActionForm action={action} className="space-y-3">
      <input type="hidden" name="period_id" value={periodId} />
      <input type="hidden" name="floor_id" value={floorId} />
      <input type="hidden" name="service_id" value={serviceId} />
      <p className="text-sm text-stone-600">
        {floorName} · {serviceName} ({unit})
      </p>
      <p className="text-sm">
        Lectura anterior:{" "}
        <strong>
          {previousReadingDisplay(previousValue, isOpeningPeriod)}
        </strong>
      </p>
      <IssueList issues={issues} />
      <fieldset disabled={disabled || pendingPhoto} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-stone-700">Lectura actual</span>
          <input
            name="value"
            inputMode="decimal"
            required
            defaultValue={currentValue}
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
          <span className="mb-1 block text-stone-700">Fotografía del contador</span>
          <input
            name="photo"
            type="file"
            accept="image/*"
            required={photoRequired}
            className="block w-full text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {pendingPhoto ? "Preparando imagen…" : "Enviar lectura"}
        </button>
      </fieldset>
    </ActionForm>
  );
}
