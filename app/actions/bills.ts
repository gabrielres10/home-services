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
import { db, dbErrorMessage, transaction } from "@/lib/db/pool";
import type { BillRow, BillingPeriodRow } from "@/lib/db/types";
import { loadCatalog } from "@/lib/data/catalog";
import { isUuid } from "@/lib/domain/ids";
import { putFile } from "@/lib/storage/files";
import { BILLS_BUCKET, MAX_BILL_PDF_BYTES, billPdfPath } from "@/lib/storage/paths";

const PDF_SIGNATURE = "%PDF-";

export async function saveBill(formData: FormData): Promise<{ error: string } | void> {
  const admin = await requireAdmin();
  const periodId = String(formData.get("period_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const pdf = formData.get("pdf");

  if (!periodId) {
    return { error: "Falta el período." };
  }
  if (!isUuid(periodId)) {
    return { error: "No se encontró el período." };
  }

  const period = await db.queryOne<Pick<BillingPeriodRow, "status">>(
    "select status from billing_periods where id = $1",
    [periodId],
  );
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

  const existing = await db.queryOne<BillRow>("select * from bills where period_id = $1", [
    periodId,
  ]);

  let pdfData: Buffer | null = null;
  if (pdf instanceof File && pdf.size > 0) {
    if (pdf.size > MAX_BILL_PDF_BYTES) {
      return { error: "El PDF no puede superar 10 MB." };
    }
    pdfData = Buffer.from(await pdf.arrayBuffer());
    // La especificación admite bytes antes de la marca, pero solo en el primer KB.
    if (!pdfData.subarray(0, 1024).includes(PDF_SIGNATURE)) {
      return { error: "El recibo debe ser un archivo PDF." };
    }
  }

  const pdfPath = pdfData ? billPdfPath(periodId) : (existing?.pdf_storage_path ?? null);
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

  const totalRows = extracted.totals.flatMap((total) => {
    const service = catalog.services.find((item) => item.code === total.serviceCode);
    if (!service || total.totalConsumption === null) {
      return [];
    }
    return [{ serviceId: service.id, totalConsumption: total.totalConsumption }];
  });

  const chargeRows = extracted.charges.flatMap((charge) => {
    const service = catalog.services.find((item) => item.code === charge.serviceCode);
    if (!service || charge.amount === null) {
      return [];
    }
    return [{ serviceId: service.id, chargeCode: charge.chargeCode, amount: charge.amount }];
  });

  // PDF, recibo, totales e importes se guardan juntos o no se guarda nada.
  try {
    await transaction(admin.id, async (tx) => {
      if (pdfData) {
        await putFile(tx, {
          bucket: BILLS_BUCKET,
          path: pdfPath,
          contentType: "application/pdf",
          data: pdfData,
        });
      }

      const bill = await tx.queryOne<{ id: string }>(
        `insert into bills
           (period_id, pdf_storage_path, uploaded_by, uploaded_at, notes, other_services_ap_subtotal)
         values ($1, $2, $3, now(), $4, $5)
         on conflict (period_id) do update
           set pdf_storage_path = excluded.pdf_storage_path,
               uploaded_by = excluded.uploaded_by,
               uploaded_at = excluded.uploaded_at,
               notes = excluded.notes,
               other_services_ap_subtotal = excluded.other_services_ap_subtotal
         returning id`,
        [periodId, pdfPath, admin.id, notes || null, extracted.otherServicesApSubtotal],
      );
      if (!bill) {
        throw new Error("No se pudo guardar el recibo.");
      }

      await tx.query("delete from bill_service_totals where bill_id = $1", [bill.id]);
      await tx.query("delete from bill_service_charges where bill_id = $1", [bill.id]);

      for (const row of totalRows) {
        await tx.query(
          `insert into bill_service_totals (bill_id, service_id, total_consumption)
           values ($1, $2, $3)`,
          [bill.id, row.serviceId, row.totalConsumption],
        );
      }
      for (const row of chargeRows) {
        await tx.query(
          `insert into bill_service_charges (bill_id, service_id, charge_code, amount)
           values ($1, $2, $3, $4)`,
          [bill.id, row.serviceId, row.chargeCode, row.amount],
        );
      }
    });
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }

  revalidatePath(`/admin/periodos/${periodId}`);
  revalidatePath("/admin");
}
