import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, describeError, explainConnectionError } from "./db-connection.mjs";

const RESET_PATH = resolve(process.cwd(), "db/reset.sql");

function parseArgs(argv) {
  return {
    yes: argv.includes("--yes") || argv.includes("-y"),
  };
}

async function main() {
  const { yes } = parseArgs(process.argv.slice(2));
  if (!yes) {
    console.error(`Esto borra períodos, recibos, lecturas, fotos, auditoría, sesiones y usuarios.

Si estás seguro:

  npm run db:reset -- --yes

Después vuelve a crear las cuentas:

  npm run user:admin -- usuario "contraseña"
  npm run user:piso-1 -- usuario "contraseña"
  npm run user:piso-2 -- usuario "contraseña"`);
    process.exit(1);
  }

  const sql = readFileSync(RESET_PATH, "utf8");
  const client = createClient();

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }

  console.log("Base de datos reiniciada.");
  console.log("Catálogo restaurado: 3 pisos, 3 servicios, 4 contadores.");
  console.log("Usuarios y archivos eliminados. Créalos de nuevo con npm run user:*");
}

main().catch((error) => {
  const message = describeError(error);
  console.error(message);
  explainConnectionError(message);
  process.exit(1);
});
