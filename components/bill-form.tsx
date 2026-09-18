"use client";

import { ActionForm } from "@/components/action-form";
import { saveBill } from "@/app/actions/bills";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  BILLS_BUCKET,
  MAX_BILL_PDF_BYTES,
  billPdfPath,
} from "@/lib/storage/paths";
import { billChargeFieldName, billChargeFields } from "@/lib/domain/bill-charges";

type ChargeField = {
  code: string;
  label: string;
  value: string;
};

type ServiceField = {
  code: string;
  name: string;
  unit: string;
  value: string;
  charges?: ChargeField[];
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
      <p className="text-sm text-stone-600">
        Copia los consumos y los importes en pesos tal como aparecen en el recibo. Cero es
        válido si ese renglón no cobra. El mínimo vital y el ajuste al peso pueden ser
        negativos.
      </p>
      <div className="space-y-4">
        {services.map((service) => {
          const fields =
            service.charges && service.charges.length > 0
              ? service.charges
              : billChargeFields(service.code).map((field) => ({
                  ...field,
                  value: "",
                }));
          return (
            <fieldset
              key={service.code}
              className="space-y-3 rounded border border-stone-200 bg-stone-50 p-4"
            >
              <legend className="px-1 text-sm font-medium text-stone-900">
                {service.name}
              </legend>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-700">
                  Total {service.name} ({service.unit})
                </span>
                <input
                  name={`total_${service.code}`}
                  inputMode="decimal"
                  defaultValue={service.value}
                  required
                  className="w-full rounded border border-stone-300 bg-white px-3 py-2"
                />
              </label>
              <p className="text-sm font-medium text-stone-800">Importes en pesos</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <label key={field.code} className="block text-sm">
                    <span className="mb-1 block text-stone-700">{field.label}</span>
                    <input
                      name={billChargeFieldName(service.code, field.code)}
                      inputMode="decimal"
                      defaultValue={field.value}
                      required
                      className="w-full rounded border border-stone-300 bg-white px-3 py-2"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
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
