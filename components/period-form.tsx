"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { createPeriod } from "@/app/actions/periods";
import { periodLabelFromDates } from "@/lib/domain/period-label";

export function PeriodForm() {
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const label = useMemo(
    () => periodLabelFromDates(startsOn, endsOn),
    [startsOn, endsOn],
  );

  return (
    <ActionForm action={createPeriod} className="max-w-md space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-stone-700">Fecha inicial</span>
        <input
          name="starts_on"
          type="date"
          required
          value={startsOn}
          onChange={(event) => setStartsOn(event.target.value)}
          className="w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-700">Fecha final</span>
        <input
          name="ends_on"
          type="date"
          required
          value={endsOn}
          onChange={(event) => setEndsOn(event.target.value)}
          className="w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <p className="rounded border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
        <span className="block text-stone-500">Nombre del período</span>
        <span className="font-medium text-stone-900">
          {label ?? "Se genera con las fechas inicial y final."}
        </span>
      </p>
      <button
        type="submit"
        className="rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-800"
      >
        Crear período
      </button>
    </ActionForm>
  );
}
