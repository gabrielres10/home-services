import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

// pg no avisa si la URL está mal escrita: usa localhost:5432 por defecto y el
// error parece un problema de red. Por eso se valida antes de conectar.
export function checkUrl(name, value, protocols, example) {
  let url = null;
  try {
    url = new URL(value);
  } catch {
    // se informa abajo
  }
  if (!url || !protocols.includes(url.protocol) || !url.hostname) {
    // Solo se muestra lo que hay antes de "//" (nunca las credenciales).
    const start = value.includes("//") ? `${value.split("//")[0]}//…` : `${value.slice(0, 12)}…`;
    throw new Error(
      `${name} no tiene un formato válido (empieza por "${start}"). Debe verse así: ${example}
` +
        "Revisa que no haya texto repetido al principio (por ejemplo el nombre de la variable o el prefijo).",
    );
  }
  return value;
}

export function checkDatabaseUrl(name, value) {
  return checkUrl(
    name,
    value,
    ["postgresql:", "postgres:"],
    "postgresql://usuario:contraseña@host:5432/base",
  );
}

export function requireDatabaseUrl() {
  loadEnvLocal();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL (en .env.local, .env o en el entorno). Ejemplo: postgresql://usuario:clave@localhost:5432/vivienda",
    );
  }
  return checkDatabaseUrl("DATABASE_URL", url);
}

export function createClient() {
  return new pg.Client({ connectionString: requireDatabaseUrl() });
}

// Node, cuando prueba varias direcciones IP y todas fallan, lanza un
// AggregateError con el mensaje vacío: el detalle está en error.errors.
export function describeError(error) {
  if (Array.isArray(error?.errors) && error.errors.length > 0) {
    const details = [...new Set(error.errors.map((item) => item.message || item.code))];
    return `${error.code ?? "Error de conexión"} (${details.join("; ")})`;
  }
  return error?.message || error?.code || String(error);
}

export function explainConnectionError(message) {
  if (
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout|SSL|self-signed|password authentication|database ".*" does not exist/i.test(
      message,
    )
  ) {
    console.error(
      "Revisa DATABASE_URL: servidor, puerto, usuario, contraseña y nombre de la base. Si tu proveedor exige SSL, añade ?sslmode=require.",
    );
  }
}
