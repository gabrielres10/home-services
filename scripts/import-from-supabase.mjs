// Copia los datos de la base de Supabase (esquema anterior) a la base nueva.
//
//   npm run db:import-supabase              → solo muestra qué haría (no escribe)
//   npm run db:import-supabase -- --yes     → importa
//
// Origen:  SUPABASE_DATABASE_URL (la URI que antes era DATABASE_URL)
// Destino: DATABASE_URL          (la base nueva, con el esquema ya aplicado)
// Archivos (PDF y fotos): se bajan por la API de Storage con
//   SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY).
//
// Conserva los UUID, así que todas las relaciones siguen valiendo. No copia las
// contraseñas: Supabase las guarda con bcrypt y esta app usa scrypt. Las cuentas
// quedan bloqueadas hasta que corras `npm run user:*` (reutiliza el mismo usuario).

import pg from "pg";
import { checkDatabaseUrl, checkUrl, describeError } from "./db-connection.mjs";
import { loadEnvLocal } from "./load-env-local.mjs";

// Sin conversiones: fechas, numéricos, instantes y json viajan como texto y
// PostgreSQL los vuelve a interpretar tal cual en el destino.
for (const oid of [1082, 1114, 1184, 1700, 114, 3802]) {
  pg.types.setTypeParser(oid, (value) => value);
}

const BUCKETS = { bills: "bills", photos: "reading-photos" };

// Orden que respeta las claves foráneas. `selfRef` es una columna que apunta a
// otra fila de la misma tabla: se insertan primero las filas de las que otras
// dependen. `defer` es una columna que apunta a una tabla que aún no existe (el
// ciclo lectura↔foto): se inserta vacía y se completa al final.
const STEPS = [
  { table: "floors" },
  { table: "services", selfRef: "copied_from_service_id" },
  { table: "floor_service_meters" },
  { table: "profiles", target: "users" },
  { table: "floor_memberships" },
  { table: "billing_periods" },
  { table: "bills" },
  { table: "bill_service_totals" },
  { table: "bill_service_charges" },
  { table: "meter_readings", defer: ["current_photo_id"] },
  { table: "reading_photos" },
  { table: "audit_logs" },
];

const AUDIT_TRIGGERS = [
  ["meter_readings", "trg_audit_meter_readings"],
  ["bills", "trg_audit_bills"],
  ["billing_periods", "trg_audit_periods"],
];

const LOCKED_PASSWORD_HASH = "!";

function parseArgs(argv) {
  return {
    yes: argv.includes("--yes") || argv.includes("-y"),
    skipFiles: argv.includes("--skip-files"),
    allowMissingFiles: argv.includes("--allow-missing-files"),
  };
}

function usage() {
  console.error(`Falta configuración. Necesitas en .env.local (o en el entorno):

  DATABASE_URL            la base NUEVA (PostgreSQL común, con el esquema aplicado)
  SUPABASE_DATABASE_URL   la URI de la base de Supabase (la que antes era DATABASE_URL)

Para copiar también los PDF y las fotos:

  SUPABASE_URL                  https://TU_PROYECTO.supabase.co
  SUPABASE_SERVICE_ROLE_KEY     la clave secret / service_role

Opciones: --yes  --skip-files  --allow-missing-files`);
}

// Supabase firma sus conexiones con una CA propia, así que el origen se lee sin
// verificar el certificado (igual que hacían antes db:schema y db:reset). Solo
// lee de Supabase; el destino sí usa la configuración normal de su URL.
function sourceClientConfig(url) {
  const parsed = new URL(url);
  const sslmode = parsed.searchParams.get("sslmode");
  const isSupabase = /\.supabase\.(co|com)$/.test(parsed.hostname);
  parsed.searchParams.delete("sslmode");
  const useSsl = sslmode ? sslmode !== "disable" : isSupabase;
  return {
    connectionString: parsed.toString(),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
}

// Con la clave publicable / anon, Storage trata la petición como anónima y, al
// ser privados los buckets, responde 404 como si los archivos no existieran.
function keyProblem(key) {
  if (key.startsWith("sb_publishable_")) {
    return "es la clave PUBLICABLE (sb_publishable_…)";
  }
  if (key.startsWith("eyJ")) {
    try {
      const { role } = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
      if (role && role !== "service_role") {
        return `es una clave JWT con role=${role}`;
      }
    } catch {
      // no se puede leer: se deja pasar y que decida Supabase
    }
  }
  return null;
}

// Si las descargas fallan, la tabla storage.objects (visible con la conexión a la
// base) dice si los archivos existen y el problema es de autenticación.
async function storageObjectsReport(source, files) {
  try {
    const { rows } = await source.query(
      "select bucket_id, name from storage.objects where bucket_id = any($1)",
      [Object.values(BUCKETS)],
    );
    const existing = new Set(rows.map((row) => `${row.bucket_id}/${row.name}`));
    const present = files.filter((file) => existing.has(`${file.bucket}/${file.path}`)).length;
    if (present === files.length) {
      return "Los archivos SÍ existen en Supabase Storage: el 404 es de autenticación. " +
        "Revisa que SUPABASE_SERVICE_ROLE_KEY sea la clave secret (sb_secret_…) o la service_role, no la publicable/anon.";
    }
    if (present === 0) {
      return "Ninguno de esos archivos existe en Supabase Storage (tabla storage.objects), " +
        "así que no se pueden recuperar por este medio.";
    }
    return `En Supabase Storage existen ${present} de esos ${files.length} archivos; ` +
      "el resto ya no está en Storage.";
  } catch {
    return null;
  }
}

async function connectOrExplain(client, label) {
  try {
    await client.connect();
  } catch (error) {
    throw new Error(`No pude conectar con ${label}: ${describeError(error)}`);
  }
}

function identifier(name) {
  return `"${name.replaceAll('"', '""')}"`;
}

async function count(client, table) {
  const { rows } = await client.query(`select count(*)::int as n from public.${identifier(table)}`);
  return rows[0].n;
}

async function readSource(source, table) {
  const result = await source.query(`select * from public.${identifier(table)}`);
  return { rows: result.rows, columns: result.fields.map((field) => field.name) };
}

async function targetColumns(target, table) {
  const { rows } = await target.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [table],
  );
  return new Set(rows.map((row) => row.column_name));
}

function orderBySelfReference(rows, column) {
  const pending = [...rows];
  const inserted = new Set();
  const ordered = [];
  while (pending.length > 0) {
    const before = pending.length;
    for (let i = 0; i < pending.length; ) {
      const row = pending[i];
      if (row[column] == null || inserted.has(row[column])) {
        ordered.push(row);
        inserted.add(row.id);
        pending.splice(i, 1);
      } else {
        i += 1;
      }
    }
    if (pending.length === before) {
      throw new Error(`Hay referencias circulares en ${column}.`);
    }
  }
  return ordered;
}

function storageUrl(baseUrl, bucket, path) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/${bucket}/${encoded}`;
}

async function downloadFile({ baseUrl, key, bucket, path, fallbackType }) {
  const response = await fetch(storageUrl(baseUrl, bucket, path), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return {
    bucket,
    path,
    contentType: response.headers.get("content-type")?.split(";")[0] || fallbackType,
    data: Buffer.from(await response.arrayBuffer()),
  };
}

async function main() {
  loadEnvLocal();
  const { yes, skipFiles, allowMissingFiles } = parseArgs(process.argv.slice(2));

  const sourceUrl = process.env.SUPABASE_DATABASE_URL?.trim();
  const targetUrl = process.env.DATABASE_URL?.trim();
  if (!sourceUrl || !targetUrl) {
    usage();
    process.exit(1);
  }
  checkDatabaseUrl("SUPABASE_DATABASE_URL", sourceUrl);
  checkDatabaseUrl("DATABASE_URL", targetUrl);
  if (sourceUrl === targetUrl) {
    throw new Error(
      "SUPABASE_DATABASE_URL y DATABASE_URL son iguales. DATABASE_URL debe apuntar a la base NUEVA.",
    );
  }

  const storageBase = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const storageKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  )?.trim();
  if (!skipFiles && (!storageBase || !storageKey)) {
    throw new Error(
      "Para copiar los PDF y las fotos hacen falta SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. " +
        "Defínelas, o usa --skip-files para importar solo los datos.",
    );
  }
  if (!skipFiles) {
    checkUrl("SUPABASE_URL", storageBase, ["https:", "http:"], "https://TU_PROYECTO.supabase.co");
    const problem = keyProblem(storageKey);
    if (problem) {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY ${problem}. No sirve para leer los archivos privados.\n` +
          "Necesitas la clave secret (sb_secret_…) o la service_role legacy: " +
          "Dashboard → Project Settings → API Keys.",
      );
    }
  }

  const source = new pg.Client(sourceClientConfig(sourceUrl));
  const target = new pg.Client({ connectionString: targetUrl });

  try {
    await connectOrExplain(source, "la base de ORIGEN (SUPABASE_DATABASE_URL)");
    await connectOrExplain(target, "la base de DESTINO (DATABASE_URL)");

    // ---- Comprobaciones previas
    const hasSchema = await target.query("select to_regclass('public.stored_files') as t");
    if (!hasSchema.rows[0].t) {
      throw new Error("La base nueva no tiene el esquema. Corre primero: npm run db:schema");
    }
    const hasSource = await source.query("select to_regclass('public.profiles') as t");
    if (!hasSource.rows[0].t) {
      throw new Error("La base de origen no tiene public.profiles. ¿Es la base de Supabase correcta?");
    }
    for (const table of ["users", "billing_periods"]) {
      if ((await count(target, table)) > 0) {
        throw new Error(
          `La base nueva ya tiene datos en ${table}. Importa sobre una base limpia: ` +
            "npm run db:reset -- --yes (borra todo y restaura el catálogo) y repite.",
        );
      }
    }

    // ---- Lectura del origen
    const data = new Map();
    for (const step of STEPS) {
      data.set(step.table, await readSource(source, step.table));
    }

    const profiles = data.get("profiles");
    if (!profiles.columns.includes("username")) {
      throw new Error(
        "profiles no tiene la columna username en Supabase. Aplica la migración 008 allí y repite.",
      );
    }
    const memberships = new Map(data.get("floor_memberships").rows.map((r) => [r.user_id, r.floor_id]));
    const floorCodes = new Map(data.get("floors").rows.map((r) => [r.id, r.code]));

    const files = [];
    if (!skipFiles) {
      for (const bill of data.get("bills").rows) {
        if (bill.pdf_storage_path) {
          files.push({ bucket: BUCKETS.bills, path: bill.pdf_storage_path, fallbackType: "application/pdf" });
        }
      }
      for (const photo of data.get("reading_photos").rows) {
        if (photo.storage_path) {
          files.push({ bucket: BUCKETS.photos, path: photo.storage_path, fallbackType: "image/jpeg" });
        }
      }
    }

    console.log("Datos encontrados en Supabase:");
    for (const step of STEPS) {
      console.log(`  ${(step.target ?? step.table).padEnd(22)} ${data.get(step.table).rows.length}`);
    }
    console.log(`  ${"archivos (PDF + fotos)".padEnd(22)} ${skipFiles ? "(omitidos)" : files.length}`);

    console.log("\nCuentas (quedarán SIN contraseña hasta que corras estos comandos):");
    for (const user of profiles.rows) {
      const floorCode = floorCodes.get(memberships.get(user.id));
      const command = user.role === "admin" ? "user:admin" : floorCode ? `user:${floorCode}` : null;
      console.log(
        command
          ? `  npm run ${command} -- ${user.username} "NuevaContraseña"`
          : `  ${user.username} (${user.role}, sin piso): sin comando automático`,
      );
    }

    if (!yes) {
      console.log("\nNo se escribió nada. Para importar de verdad: npm run db:import-supabase -- --yes");
      return;
    }

    // ---- Archivos (antes de tocar el destino: si algo falla, no queda nada a medias)
    const downloaded = [];
    const missing = [];
    for (const file of files) {
      try {
        downloaded.push(await downloadFile({ baseUrl: storageBase, key: storageKey, ...file }));
      } catch (error) {
        missing.push(`${file.bucket}/${file.path} (${error.message})`);
      }
    }
    if (missing.length > 0) {
      console.error(`\nNo pude bajar ${missing.length} archivo(s) de Storage:`);
      for (const line of missing) console.error(`  - ${line}`);
      const report = await storageObjectsReport(source, files);
      if (report) console.error(`\n${report}`);
      if (!allowMissingFiles) {
        throw new Error(
          "Importación cancelada; el destino no se tocó. Revisa SUPABASE_URL / la clave, " +
            "o usa --allow-missing-files para importar igual sin esos archivos.",
        );
      }
    }
    if (!skipFiles) {
      console.log(`\nArchivos descargados: ${downloaded.length}/${files.length}`);
    }

    // ---- Escritura: todo en una transacción
    await target.query("begin");
    try {
      // El catálogo sembrado en el destino se reemplaza por el del origen (otros UUID).
      await target.query("truncate table public.floor_service_meters, public.services, public.floors cascade");
      // Los triggers de auditoría duplicarían filas: se apagan mientras se copia
      // (el historial real viene en audit_logs) y se reactivan al final.
      for (const [table, trigger] of AUDIT_TRIGGERS) {
        await target.query(`alter table public.${identifier(table)} disable trigger ${identifier(trigger)}`);
      }

      const deferred = [];
      for (const step of STEPS) {
        const targetTable = step.target ?? step.table;
        const { rows, columns } = data.get(step.table);
        if (rows.length === 0) continue;

        const known = await targetColumns(target, targetTable);
        const copied = columns.filter((column) => known.has(column));
        const defer = (step.defer ?? []).filter((column) => copied.includes(column));
        const insertColumns = step.table === "profiles" ? [...copied, "password_hash"] : copied;

        const sql = `insert into public.${identifier(targetTable)} (${insertColumns
          .map(identifier)
          .join(", ")}) values (${insertColumns.map((_, i) => `$${i + 1}`).join(", ")})`;

        const ordered = step.selfRef ? orderBySelfReference(rows, step.selfRef) : rows;
        for (const row of ordered) {
          const values = copied.map((column) => (defer.includes(column) ? null : row[column]));
          if (step.table === "profiles") values.push(LOCKED_PASSWORD_HASH);
          await target.query(sql, values);
          for (const column of defer) {
            if (row[column] !== null && row[column] !== undefined) {
              deferred.push({ table: targetTable, column, id: row.id, value: row[column] });
            }
          }
        }
      }

      for (const { table, column, id, value } of deferred) {
        await target.query(
          `update public.${identifier(table)} set ${identifier(column)} = $1 where id = $2`,
          [value, id],
        );
      }

      for (const file of downloaded) {
        await target.query(
          `insert into public.stored_files (bucket, path, content_type, size_bytes, data)
           values ($1, $2, $3, $4, $5)`,
          [file.bucket, file.path, file.contentType, file.data.length, file.data],
        );
      }

      for (const [table, trigger] of AUDIT_TRIGGERS) {
        await target.query(`alter table public.${identifier(table)} enable trigger ${identifier(trigger)}`);
      }
      await target.query("commit");
    } catch (error) {
      await target.query("rollback").catch(() => undefined);
      throw error;
    }

    console.log("\nImportación terminada. Filas en la base nueva:");
    for (const step of STEPS) {
      const targetTable = step.target ?? step.table;
      console.log(`  ${targetTable.padEnd(22)} ${await count(target, targetTable)}`);
    }
    console.log(`  ${"stored_files".padEnd(22)} ${await count(target, "stored_files")}`);
    console.log("\nSiguiente paso: crea la contraseña de cada cuenta con los comandos de arriba.");
  } finally {
    // Siempre se cierran, incluso si falló al conectar: salir con sockets a medio
    // cerrar provoca un "Assertion failed" de libuv en Windows.
    await source.end().catch(() => undefined);
    await target.end().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = describeError(error);
  console.error(message);
  if (/ENOTFOUND|ENETUNREACH/.test(message) && /db\.[a-z0-9]+\.supabase\.co/.test(message)) {
    console.error(
      "\nEse es el host de la conexión directa de Supabase, que solo responde por IPv6.\n" +
        "Usa la URI del Session pooler (host ...pooler.supabase.com, usuario postgres.TU_REF):\n" +
        "en el dashboard, botón Connect → Session pooler.",
    );
  }
  process.exitCode = 1;
});
