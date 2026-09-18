"use client";

import { ActionForm } from "@/components/action-form";
import { saveBill } from "@/app/actions/bills";

type ServiceField = {
  code: string;
  name: string;
  unit: string;
  value: string;
};

export function BillForm({
  periodId,
  services,
  notes,
  hasPdf,
}: {
  periodId: string;
  services: ServiceField[];
  notes: string;
  hasPdf: boolean;
}) {
  return (
    <ActionForm action={saveBill} className="space-y-4">
      <input type="hidden" name="period_id" value={periodId} />
      <label className="block text-sm">
        <span className="mb-1 block text-stone-700">
          PDF del recibo {hasPdf ? "(opcional si ya está cargado)" : ""}
        </span>
        <input
          name="pdf"
          type="file"
          accept="application/pdf"
          required={!hasPdf}
          className="block w-full text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {services.map((service) => (
          <label key={service.code} className="block text-sm">
            <span className="mb-1 block text-stone-700">
              Total {service.name} ({service.unit})
            </span>
            <input
              name={`total_${service.code}`}
              inputMode="decimal"
              defaultValue={service.value}
              required
              className="w-full rounded border border-stone-300 px-3 py-2"
            />
          </label>
        ))}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-700">Notas</span>
        <textarea
          name="notes"
          defaultValue={notes}
          rows={2}
          className="w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-800"
      >
        Guardar recibo
      </button>
    </ActionForm>
  );
}
