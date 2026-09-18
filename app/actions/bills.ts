"use server";

import { revalidatePath } from "next/cache";
import { extractBillDraft } from "@/lib/billing/extractor";
import { requireAdmin } from "@/lib/auth/current-user";
import {
  BILL_CHARGE_CATALOG,
  billChargeFieldName,
  isServiceCode,
} from "@/lib/domain/bill-charges";
import { parseMoneyAmount, parseReadingValue } from "@/lib/domain/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadCatalog } from "@/lib/data/catalog";
import { billPdfPath } from "@/lib/storage/paths";

export async function saveBill(formData: FormData): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  const periodId = String(formData.get("period_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const uploadedPath = String(formData.get("pdf_storage_path") ?? "").trim();

  if (!periodId) {
    return { error: "Falta el período." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: period } = await supabase
    .from("billing_periods")
    .select("status")
    .eq("id", periodId)
    .maybeSingle();
  if (!period) {
    return { error: "No se encontró el período." };
  }
  if (period.status === "closed") {
    return { error: "El período está cerrado. Reábrelo para cambiar el recibo." };
  }

  const catalog = await loadCatalog();
  const manualTotals = catalog.services.map((service) => {
    const parsed = parseReadingValue(String(formData.get(`total_${service.code}`) ?? ""));
    return {
      serviceCode: service.code,
      totalConsumption: parsed.ok ? parsed.value : null,
    };
  });

  const chargeErrors: string[] = [];
  const manualCharges = catalog.services.flatMap((service) => {
    if (!isServiceCode(service.code)) {
      return [];
    }
    return BILL_CHARGE_CATALOG[service.code].map((field) => {
      const parsed = parseMoneyAmount(
        String(formData.get(billChargeFieldName(service.code, field.code)) ?? ""),
      );
      if (!parsed.ok) {
        chargeErrors.push(`${service.name}: ${field.label}. ${parsed.issue.message}`);
        return {
          serviceCode: service.code,
          chargeCode: field.code,
          amount: null,
        };
      }
      return {
        serviceCode: service.code,
        chargeCode: field.code,
        amount: parsed.value,
      };
    });
  });

  const otherServicesApParsed = parseMoneyAmount(
    String(formData.get("other_services_ap_subtotal") ?? ""),
  );

  const extracted = await extractBillDraft(null, {
    totals: manualTotals,
    charges: manualCharges,
    otherServicesApSubtotal: otherServicesApParsed.ok ? otherServicesApParsed.value : null,
  });

  const { data: existing } = await supabase
    .from("bills")
    .select("*")
    .eq("period_id", periodId)
    .maybeSingle();

  const expectedPath = billPdfPath(periodId);
  if (uploadedPath && uploadedPath !== expectedPath) {
    return { error: "La ruta del PDF no es válida." };
  }

  const pdfPath = uploadedPath || existing?.pdf_storage_path || null;
  if (!pdfPath) {
    return { error: "Debes cargar el PDF del recibo." };
  }

  const missingTotals = extracted.totals.filter((item) => item.totalConsumption === null);
  if (missingTotals.length > 0) {
    return { error: "Introduce el consumo total de cada servicio." };
  }
  if (chargeErrors.length > 0) {
    return { error: chargeErrors.join(" ") };
  }
  if (extracted.charges.some((item) => item.amount === null)) {
    return { error: "Introduce todos los importes en dinero de cada servicio." };
  }
  if (!otherServicesApParsed.ok) {
    return {
      error: `Subtotal otros servicios + AP. ${otherServicesApParsed.issue.message}`,
    };
  }
  if (extracted.otherServicesApSubtotal === null) {
    return { error: "Introduce el subtotal de otros servicios + AP (alumbrado público)." };
  }

  const { data: bill, error: billError } = existing
    ? await supabase
        .from("bills")
        .update({
          pdf_storage_path: pdfPath,
          uploaded_by: admin.id,
          uploaded_at: new Date().toISOString(),
          notes: notes || null,
          other_services_ap_subtotal: extracted.otherServicesApSubtotal,
        })
        .eq("id", existing.id)
        .select("id")
        .single()
    : await supabase
        .from("bills")
        .insert({
          period_id: periodId,
          pdf_storage_path: pdfPath,
          uploaded_by: admin.id,
          uploaded_at: new Date().toISOString(),
          notes: notes || null,
          other_services_ap_subtotal: extracted.otherServicesApSubtotal,
        })
        .select("id")
        .single();

  if (billError || !bill) {
    return { error: billError?.message ?? "No se pudo guardar el recibo." };
  }

  const { error: deleteTotalsError } = await supabase
    .from("bill_service_totals")
    .delete()
    .eq("bill_id", bill.id);

  if (deleteTotalsError) {
    return { error: deleteTotalsError.message };
  }

  const { error: deleteChargesError } = await supabase
    .from("bill_service_charges")
    .delete()
    .eq("bill_id", bill.id);

  if (deleteChargesError) {
    return { error: deleteChargesError.message };
  }

  const rows = extracted.totals.flatMap((total) => {
    const service = catalog.services.find((item) => item.code === total.serviceCode);
    if (!service || total.totalConsumption === null) {
      return [];
    }
    return [
      {
        bill_id: bill.id,
        service_id: service.id,
        total_consumption: total.totalConsumption,
      },
    ];
  });

  const { error: totalsError } = await supabase.from("bill_service_totals").insert(rows);
  if (totalsError) {
    return { error: totalsError.message };
  }

  const chargeRows = extracted.charges.flatMap((charge) => {
    const service = catalog.services.find((item) => item.code === charge.serviceCode);
    if (!service || charge.amount === null) {
      return [];
    }
    return [
      {
        bill_id: bill.id,
        service_id: service.id,
        charge_code: charge.chargeCode,
        amount: charge.amount,
      },
    ];
  });

  const { error: chargesError } = await supabase.from("bill_service_charges").insert(chargeRows);
  if (chargesError) {
    return { error: chargesError.message };
  }

  revalidatePath(`/admin/periodos/${periodId}`);
  revalidatePath("/admin");
}
