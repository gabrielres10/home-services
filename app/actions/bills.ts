"use server";

import { revalidatePath } from "next/cache";
import { extractBillDraft } from "@/lib/billing/extractor";
import { requireAdmin } from "@/lib/auth/current-user";
import { parseReadingValue } from "@/lib/domain/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadCatalog } from "@/lib/data/catalog";
import { BILLS_BUCKET, billPdfPath } from "@/lib/storage/paths";

export async function saveBill(formData: FormData): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  const periodId = String(formData.get("period_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const pdf = formData.get("pdf");

  if (!periodId) {
    return { error: "Falta el período." };
  }

  const catalog = await loadCatalog();
  const manualTotals = catalog.services.map((service) => {
    const parsed = parseReadingValue(String(formData.get(`total_${service.code}`) ?? ""));
    return {
      serviceCode: service.code,
      totalConsumption: parsed.ok ? parsed.value : null,
    };
  });

  const file = pdf instanceof File && pdf.size > 0 ? pdf : null;
  if (file && file.type !== "application/pdf") {
    return { error: "El recibo debe ser un archivo PDF." };
  }

  const extracted = await extractBillDraft(file, { totals: manualTotals });
  const supabase = await createServerSupabaseClient();

  const { data: existing } = await supabase
    .from("bills")
    .select("*")
    .eq("period_id", periodId)
    .maybeSingle();

  let pdfPath = existing?.pdf_storage_path ?? null;
  if (file) {
    pdfPath = billPdfPath(periodId);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BILLS_BUCKET)
      .upload(pdfPath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) {
      return { error: `No se pudo guardar el PDF: ${uploadError.message}` };
    }
  }

  if (!pdfPath) {
    return { error: "Debes cargar el PDF del recibo." };
  }

  const missingTotals = extracted.totals.filter((item) => item.totalConsumption === null);
  if (missingTotals.length > 0) {
    return { error: "Introduce el consumo total de cada servicio." };
  }

  const { data: bill, error: billError } = existing
    ? await supabase
        .from("bills")
        .update({
          pdf_storage_path: pdfPath,
          uploaded_by: admin.id,
          uploaded_at: new Date().toISOString(),
          notes: notes || null,
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
        })
        .select("id")
        .single();

  if (billError || !bill) {
    return { error: billError?.message ?? "No se pudo guardar el recibo." };
  }

  const { error: deleteError } = await supabase
    .from("bill_service_totals")
    .delete()
    .eq("bill_id", bill.id);

  if (deleteError) {
    return { error: deleteError.message };
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

  revalidatePath(`/admin/periodos/${periodId}`);
  revalidatePath("/admin");
}
