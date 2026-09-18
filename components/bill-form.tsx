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
      <div className="file-drop">
        <p className="file-drop-title">PDF del recibo</p>
        <p className="muted text-[0.9rem]">
          Es el archivo que envió la empresa. Tiene que ser un PDF. Pulsa el botón
          verde para buscarlo en el computador.
        </p>
        <label className="field">
          <span className="sr-only">Archivo PDF del recibo</span>
          <input
            name="pdf"
            type="file"
            accept="application/pdf"
            required={!hasPdf && !locked}
            disabled={locked}
            className="input-control file-control"
          />
        </label>
        <p className={hasPdf ? "text-[0.9rem]" : "muted text-[0.9rem]"}>
          {hasPdf
            ? "Ya hay un PDF cargado. Abajo puedes verlo. Elige otro solo si quieres reemplazarlo."
            : "Todavía no hay PDF. Sin este archivo no se puede guardar el recibo."}
        </p>
      </div>
      <p className="muted text-[0.92rem]">
        Después copia los números tal como aparecen en el recibo. Si un renglón no
        cobra, escribe 0. El mínimo vital y el ajuste al peso pueden ser negativos.
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
            <fieldset key={service.code} className="fieldset-panel">
              <legend>{service.name}</legend>
              <p className="fieldset-lead">
                Primero el consumo total en {service.unit}. Luego cada renglón en
                pesos, con el mismo nombre que en el recibo.
              </p>
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
                  className="input-control input-figure"
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
                      className="input-control input-figure"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <fieldset className="fieldset-panel">
        <legend>Toda la vivienda</legend>
        <p className="fieldset-lead">
          Un solo valor del recibo para toda la casa. AP significa alumbrado público.
        </p>
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
            className="input-control input-figure"
          />
        </label>
      </fieldset>
      <label className="field">
        <span className="field-label">Notas (opcional)</span>
        <textarea
          name="notes"
          defaultValue={notes}
          rows={2}
          disabled={locked}
          className="input-control"
        />
      </label>
      {locked ? null : (
        <div>
          <p className="save-hint">
            Cuando termines, pulsa este botón. Si no lo pulsas, los números no se
            guardan.
          </p>
          <SubmitButton pendingLabel="Guardando…">Guardar recibo</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
