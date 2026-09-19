import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { requireDatabaseUrl } from "./db-connection.mjs";

const RESET_PATH = resolve(process.cwd(), "supabase/reset.sql");
const BUCKETS = ["bills", "reading-photos"];

function parseArgs(argv) {
  return {
    yes: argv.includes("--yes") || argv.includes("-y"),
  };
}

function createServiceClient() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local.");
  }
  if (!serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local para vaciar Storage.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function listObjectPaths(supabase, bucket, prefix = "") {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
  });
  if (error) {
    throw new Error(`No pude listar ${bucket}/${prefix}: ${error.message}`);
  }

  const paths = [];
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      paths.push(...(await listObjectPaths(supabase, bucket, path)));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

async function emptyBucket(supabase, bucket) {
  const paths = await listObjectPaths(supabase, bucket);
  if (paths.length === 0) {
    console.log(`Storage ${bucket}: vacío`);
    return;
  }

  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) {
      throw new Error(`No pude borrar archivos de ${bucket}: ${error.message}`);
    }
  }
  console.log(`Storage ${bucket}: ${paths.length} archivo(s) eliminados`);
}

async function main() {
  const { yes } = parseArgs(process.argv.slice(2));
  if (!yes) {
    console.error(`Esto borra períodos, recibos, lecturas, fotos, auditoría y usuarios de Auth.

Si estás seguro:

  npm run db:reset -- --yes

Después vuelve a crear las cuentas:

  npm run user:admin -- usuario "contraseña"
  npm run user:piso-1 -- usuario "contraseña"
  npm run user:piso-2 -- usuario "contraseña"`);
    process.exit(1);
  }

  const supabase = createServiceClient();
  for (const bucket of BUCKETS) {
    await emptyBucket(supabase, bucket);
  }

  const sql = readFileSync(RESET_PATH, "utf8");
  const url = requireDatabaseUrl();
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }

  console.log("Base de datos reiniciada.");
  console.log("Catálogo restaurado: 3 pisos, 3 servicios, 4 contadores.");
  console.log("Usuarios de Auth eliminados. Créalos de nuevo con npm run user:*");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (/ENOTFOUND|ECONNREFUSED|timeout|ETIMEDOUT|self-signed/i.test(message)) {
    console.error("Revisa DATABASE_URL (Session pooler) en .env.local.");
  }
  process.exit(1);
});
