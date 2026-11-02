import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, describeError, explainConnectionError } from "./db-connection.mjs";

const MIGRATIONS_DIR = resolve(process.cwd(), "db/migrations");

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error("No hay archivos .sql en db/migrations.");
  }

  const client = createClient();
  await client.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const { rows } = await client.query("select name from schema_migrations");
    const applied = new Set(rows.map((row) => row.name));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }
      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${file}: ${error instanceof Error ? error.message : error}`);
      }
      console.log(`Aplicado: ${file}`);
      count += 1;
    }

    if (count === 0) {
      console.log("La base de datos ya está al día.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = describeError(error);
  console.error(message);
  explainConnectionError(message);
  process.exit(1);
});
