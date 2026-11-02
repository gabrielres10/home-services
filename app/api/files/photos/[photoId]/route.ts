import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db/pool";
import { isUuid } from "@/lib/domain/ids";
import { canViewPhoto } from "@/lib/domain/permissions";
import { getFile } from "@/lib/storage/files";
import { PHOTOS_BUCKET } from "@/lib/storage/paths";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/files/photos/[photoId]">) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(null, { status: 401 });
  }

  const { photoId } = await ctx.params;
  if (!isUuid(photoId)) {
    return new Response(null, { status: 404 });
  }

  const photo = await db.queryOne<{ storage_path: string; floor_id: string }>(
    `select p.storage_path, r.floor_id
     from reading_photos p
     join meter_readings r on r.id = p.reading_id
     where p.id = $1`,
    [photoId],
  );
  if (!photo) {
    return new Response(null, { status: 404 });
  }

  // Un piso solo ve las fotos de sus propios contadores; el administrador, todas.
  const allowed = canViewPhoto({
    role: user.role,
    actorFloorId: user.floorId,
    readingFloorId: photo.floor_id,
  });
  if (!allowed) {
    return new Response(null, { status: 404 });
  }

  const file = await getFile(PHOTOS_BUCKET, photo.storage_path);
  if (!file) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.data.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
