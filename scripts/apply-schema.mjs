import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { requireDatabaseUrl } from "./db-connection.mjs";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error("No hay archivos .sql en supabase/migrations.");
  }

  const url = requireDatabaseUrl();

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
