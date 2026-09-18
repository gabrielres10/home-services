"use client";

import { ActionForm } from "@/components/action-form";
import { createPeriod } from "@/app/actions/periods";

export function PeriodForm() {
  return (
    <ActionForm action={createPeriod} className="max-w-md space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-stone-700">Nombre del período</span>
        <input
          name="label"
          required
          placeholder="Septiembre 2026"
          className="w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-700">Fecha inicial</span>
        <input
          name="starts_on"
          type="date"
          required
          className="w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-700">Fecha final</span>
        <input
          name="ends_on"
          type="date"
          required
          className="w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-800"
      >
        Crear período
      </button>
    </ActionForm>
  );
}
