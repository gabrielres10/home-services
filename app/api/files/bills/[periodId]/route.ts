import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db/pool";
import { isUuid } from "@/lib/domain/ids";
import { canViewBill } from "@/lib/domain/permissions";
import { getFile } from "@/lib/storage/files";
import { BILLS_BUCKET } from "@/lib/storage/paths";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/files/bills/[periodId]">) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(null, { status: 401 });
  }
  if (!canViewBill(user.role)) {
    return new Response(null, { status: 403 });
  }

  const { periodId } = await ctx.params;
  if (!isUuid(periodId)) {
    return new Response(null, { status: 404 });
  }

  const bill = await db.queryOne<{ pdf_storage_path: string | null }>(
    "select pdf_storage_path from bills where period_id = $1",
    [periodId],
  );
  const file = bill?.pdf_storage_path
    ? await getFile(BILLS_BUCKET, bill.pdf_storage_path)
    : null;
  if (!file) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.data.length),
      "Content-Disposition": 'inline; filename="recibo.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
