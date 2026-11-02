import "server-only";
import { db, type Queryable } from "@/lib/db/pool";

export type StoredFile = {
  contentType: string;
  data: Buffer;
};

export async function putFile(
  tx: Queryable,
  input: { bucket: string; path: string; contentType: string; data: Buffer },
): Promise<void> {
  await tx.query(
    `insert into stored_files (bucket, path, content_type, size_bytes, data)
     values ($1, $2, $3, $4, $5)
     on conflict (bucket, path) do update
       set content_type = excluded.content_type,
           size_bytes = excluded.size_bytes,
           data = excluded.data,
           created_at = now()`,
    [input.bucket, input.path, input.contentType, input.data.length, input.data],
  );
}

export async function getFile(bucket: string, path: string): Promise<StoredFile | null> {
  const row = await db.queryOne<{ content_type: string; data: Buffer }>(
    "select content_type, data from stored_files where bucket = $1 and path = $2",
    [bucket, path],
  );
  return row ? { contentType: row.content_type, data: row.data } : null;
}

export async function deleteFiles(
  tx: Queryable,
  bucket: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  await tx.query("delete from stored_files where bucket = $1 and path = any($2::text[])", [
    bucket,
    paths,
  ]);
}

// Borra todo lo que cuelga de una carpeta lógica ("{periodId}/...").
export async function deleteFolder(
  tx: Queryable,
  bucket: string,
  folder: string,
): Promise<void> {
  await tx.query("delete from stored_files where bucket = $1 and path like $2", [
    bucket,
    `${folder}/%`,
  ]);
}
