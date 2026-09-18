"use client";

import { ActionForm } from "@/components/action-form";
import { saveBill } from "@/app/actions/bills";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  BILLS_BUCKET,
  MAX_BILL_PDF_BYTES,
  billPdfPath,
} from "@/lib/storage/paths";

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
  async function action(formData: FormData) {
    const pdf = formData.get("pdf");
    formData.delete("pdf");

    if (pdf instanceof File && pdf.size > 0) {
      if (pdf.type !== "application/pdf") {
        return { error: "El recibo debe ser un archivo PDF." };
      }
      if (pdf.size > MAX_BILL_PDF_BYTES) {
        return { error: "El PDF no puede superar 10 MB." };
      }

      const path = billPdfPath(periodId);
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.storage.from(BILLS_BUCKET).upload(path, pdf, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (error) {
        return { error: `No se pudo guardar el PDF: ${error.message}` };
      }
      formData.set("pdf_storage_path", path);
    }

    return saveBill(formData);
  }

  return (
    <ActionForm action={action} className="space-y-4">
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
