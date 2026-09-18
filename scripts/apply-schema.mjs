import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    const [ref] = host.split(".");
    return ref || null;
  } catch {
    return null;
  }
}

function connectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const password = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ref = supabaseUrl ? projectRefFromUrl(supabaseUrl) : null;

  if (password && ref) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
  }

  return null;
}

async function main() {
  loadEnvLocal();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error("No hay archivos .sql en supabase/migrations.");
  }

  const url = connectionString();
  if (!url) {
    throw new Error(
      "Falta la conexión a Postgres. Añade DATABASE_URL en .env.local (URI del Session pooler).",
    );
  }

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
      await client.query(sql);
      console.log(`Aplicado: ${file}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (/ENOTFOUND|ECONNREFUSED|timeout|ETIMEDOUT|self-signed/i.test(message)) {
    console.error(
      "Si el host db.<proyecto>.supabase.co no conecta, en el dashboard copia la URI de Connection string (Session pooler) en DATABASE_URL.",
    );
  }
  process.exit(1);
});
