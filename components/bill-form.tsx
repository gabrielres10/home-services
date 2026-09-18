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
import { SubmitButton } from "@/components/submit-button";

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
  otherServicesApSubtotal,
  locked = false,
}: {
  periodId: string;
  services: ServiceField[];
  notes: string;
  hasPdf: boolean;
  otherServicesApSubtotal: string;
  locked?: boolean;
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
    <ActionForm action={action} className="stack-lg">
      {locked ? (
        <p className="notice">
          El período está cerrado. Reábrelo para cambiar el recibo.
        </p>
      ) : null}
      <input type="hidden" name="period_id" value={periodId} />
      <label className="field">
        <span className="field-label">
          PDF del recibo {hasPdf ? "(opcional si ya está cargado)" : ""}
        </span>
        <input
          name="pdf"
          type="file"
          accept="application/pdf"
          required={!hasPdf && !locked}
          disabled={locked}
          className="input-control file-control"
        />
      </label>
      <p className="muted text-[0.92rem]">
        Copia los consumos y los importes en pesos tal como aparecen en el recibo. Cero es
        válido si ese renglón no cobra. El mínimo vital y el ajuste al peso pueden ser
        negativos.
      </p>
      <div className="stack-lg">
        {services.map((service) => {
          const fields =
            service.charges && service.charges.length > 0
              ? service.charges
              : billChargeFields(service.code).map((field) => ({
                  ...field,
                  value: "",
                }));
          return (
            <fieldset key={service.code} className="fieldset-block">
              <legend>{service.name}</legend>
              <label className="field">
                <span className="field-label">
                  Total {service.name} ({service.unit})
                </span>
                <input
                  name={`total_${service.code}`}
                  inputMode="decimal"
                  defaultValue={service.value}
                  required
                  disabled={locked}
                  className="input-control figure"
                />
              </label>
              <p className="field-label mt-5 mb-2">Importes en pesos</p>
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {fields.map((field) => (
                  <label key={field.code} className="field">
                    <span className="field-label">{field.label}</span>
                    <input
                      name={billChargeFieldName(service.code, field.code)}
                      inputMode="decimal"
                      defaultValue={field.value}
                      required
                      disabled={locked}
                      className="input-control figure"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <fieldset className="fieldset-block">
        <legend>Toda la vivienda</legend>
        <label className="field">
          <span className="field-label">
            Subtotal otros servicios + AP (alumbrado público)
          </span>
          <input
            name="other_services_ap_subtotal"
            inputMode="decimal"
            defaultValue={otherServicesApSubtotal}
            required
            disabled={locked}
            className="input-control figure"
          />
        </label>
        <p className="muted mt-2 text-[0.78rem]">
          Un solo valor del recibo para toda la casa. AP significa alumbrado público.
        </p>
      </fieldset>
      <label className="field">
        <span className="field-label">Notas</span>
        <textarea
          name="notes"
          defaultValue={notes}
          rows={2}
          disabled={locked}
          className="input-control"
        />
      </label>
      {locked ? null : (
        <SubmitButton pendingLabel="Guardando…">Guardar recibo</SubmitButton>
      )}
    </ActionForm>
  );
}
