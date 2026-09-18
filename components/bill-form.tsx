"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { saveBill } from "@/app/actions/bills";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  BILLS_BUCKET,
  MAX_BILL_PDF_BYTES,
  billPdfPath,
} from "@/lib/storage/paths";
import { billChargeFieldName, billChargeFields } from "@/lib/domain/bill-charges";
import { numberToInputRaw } from "@/lib/domain/numeric";
import { countExtractedValues, parseEmcaliBillText } from "@/lib/billing/emcali-parser";
import { describeExtractError, readPdfPageOneText } from "@/lib/billing/pdf-reader";
import type { ExtractedBillDraft } from "@/lib/billing/extractor";
import { NumericInput } from "@/components/numeric-input";
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

type FilledBill = {
  totals: Record<string, string>;
  charges: Record<string, string>;
  ap: string;
};

function draftToFilled(draft: ExtractedBillDraft, services: ServiceField[]): FilledBill {
  const totals: Record<string, string> = {};
  const charges: Record<string, string> = {};
  for (const service of services) {
    const total = draft.totals.find((item) => item.serviceCode === service.code);
    totals[service.code] =
      total?.totalConsumption === null || total?.totalConsumption === undefined
        ? service.value
        : numberToInputRaw(total.totalConsumption);
    const fields =
      service.charges && service.charges.length > 0
        ? service.charges
        : billChargeFields(service.code).map((field) => ({ ...field, value: "" }));
    for (const field of fields) {
      const name = billChargeFieldName(service.code, field.code);
      const found = draft.charges.find(
        (item) => item.serviceCode === service.code && item.chargeCode === field.code,
      );
      charges[name] =
        found?.amount === null || found?.amount === undefined
          ? field.value
          : numberToInputRaw(found.amount);
    }
  }
  return {
    totals,
    charges,
    ap:
      draft.otherServicesApSubtotal === null
        ? ""
        : numberToInputRaw(draft.otherServicesApSubtotal),
  };
}

function extractStatusMessage(count: number): string {
  if (count === 0) {
    return "Leí el PDF, pero no reconocí los renglones. Completa los números a mano.";
  }
  return `Rellené ${count} campo${count === 1 ? "" : "s"} con lo que pude leer. Completa los vacíos, revisa y pulsa Guardar recibo.`;
}

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
  const [filled, setFilled] = useState<FilledBill | null>(null);
  const [fieldKey, setFieldKey] = useState(0);
  const [extractStatus, setExtractStatus] = useState<"idle" | "reading" | "ok" | "error">(
    "idle",
  );
  const [extractMessage, setExtractMessage] = useState<string | null>(null);

  function applyDraft(draft: ExtractedBillDraft) {
    const count = countExtractedValues(draft);
    if (count === 0) {
      setExtractStatus("error");
      setExtractMessage(extractStatusMessage(0));
      return;
    }
    setFilled(draftToFilled(draft, services));
    setFieldKey((value) => value + 1);
    setExtractStatus("ok");
    setExtractMessage(extractStatusMessage(count));
  }

  async function action(formData: FormData) {
    const pdf = formData.get("pdf");
    formData.delete("pdf");

    if (pdf instanceof File && pdf.size > 0) {
      if (pdf.type !== "application/pdf" && !pdf.name.toLowerCase().endsWith(".pdf")) {
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

  async function onPdfChosen(file: File | null) {
    if (!file || locked) {
      return;
    }
    setExtractStatus("reading");
    setExtractMessage("Leyendo la página 1 del recibo…");
    try {
      const text = await readPdfPageOneText(file);
      applyDraft(parseEmcaliBillText(text));
    } catch (error) {
      setExtractStatus("error");
      setExtractMessage(
        `No pude leer el PDF (${describeExtractError(error)}). Completa los números a mano.`,
      );
    }
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
          Elige el PDF de EMCALI. Se lee sola la página 1 y se copian los importes
          de Total a Pagar. Si un campo no sale, queda vacío para que lo completes.
        </p>
        <label className="field">
          <span className="sr-only">Archivo PDF del recibo</span>
          <input
            name="pdf"
            type="file"
            accept="application/pdf"
            required={!hasPdf && !locked}
            disabled={locked || extractStatus === "reading"}
            className="input-control file-control"
            onChange={(event) => {
              void onPdfChosen(event.target.files?.[0] ?? null);
            }}
          />
        </label>
        {extractMessage ? (
          <p
            className={
              extractStatus === "error"
                ? "notice notice-error"
                : extractStatus === "ok"
                  ? "notice notice-info"
                  : "muted text-[0.9rem]"
            }
          >
            {extractMessage}
          </p>
        ) : (
          <p className={hasPdf ? "text-[0.9rem]" : "muted text-[0.9rem]"}>
            {hasPdf
              ? "Ya hay un PDF cargado. Abajo puedes verlo. Elige otro si quieres reemplazarlo y volver a leerlo."
              : "Todavía no hay PDF. Sin este archivo no se puede guardar el recibo."}
          </p>
        )}
      </div>
      <p className="muted text-[0.92rem]">
        Si un renglón no cobra, deja 0. El mínimo vital y el ajuste al peso pueden
        ser negativos. No copies lecturas del medidor: esas las envía cada piso.
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
                pesos, copiado de Total a Pagar.
              </p>
              <label className="field">
                <span className="field-label">
                  Total {service.name} ({service.unit})
                </span>
                <NumericInput
                  key={`${fieldKey}-total-${service.code}`}
                  name={`total_${service.code}`}
                  defaultValue={filled?.totals[service.code] ?? service.value}
                  required
                  disabled={locked || extractStatus === "reading"}
                />
              </label>
              <p className="field-label mt-5 mb-2">Importes en pesos</p>
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {fields.map((field) => {
                  const name = billChargeFieldName(service.code, field.code);
                  return (
                    <label key={field.code} className="field">
                      <span className="field-label">{field.label}</span>
                      <NumericInput
                        key={`${fieldKey}-${name}`}
                        name={name}
                        kind="money"
                        defaultValue={filled?.charges[name] ?? field.value}
                        required
                        disabled={locked || extractStatus === "reading"}
                      />
                    </label>
                  );
                })}
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
          <NumericInput
            key={`${fieldKey}-ap`}
            name="other_services_ap_subtotal"
            kind="money"
            defaultValue={filled?.ap ?? otherServicesApSubtotal}
            required
            disabled={locked || extractStatus === "reading"}
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
