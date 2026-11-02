import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { requireDatabaseUrl } from "./env";

// Que pg entregue lo mismo que antes recibía la aplicación: fechas como
// "YYYY-MM-DD", instantes como ISO, y numéricos / conteos como number.
const PG_DATE = 1082;
const PG_TIMESTAMPTZ = 1184;
const PG_NUMERIC = 1700;
const PG_INT8 = 20;

types.setTypeParser(PG_DATE, (value) => value);
types.setTypeParser(PG_TIMESTAMPTZ, (value) => new Date(value).toISOString());
types.setTypeParser(PG_NUMERIC, (value) => Number(value));
types.setTypeParser(PG_INT8, (value) => Number(value));

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
  queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null>;
};

const globalForPool = globalThis as unknown as { homeServicesPool?: Pool };

// Se crea al primer uso (no al importar) para que `next build` no exija la
// base de datos, y se guarda en globalThis para sobrevivir al hot reload.
function getPool(): Pool {
  if (!globalForPool.homeServicesPool) {
    const pool = new Pool({ connectionString: requireDatabaseUrl(), max: 10 });
    pool.on("error", (error) => {
      console.error("Error en una conexión inactiva de PostgreSQL:", error.message);
    });
    globalForPool.homeServicesPool = pool;
  }
  return globalForPool.homeServicesPool;
}

function queryable(
  run: (text: string, params?: unknown[]) => Promise<QueryResultRow[]>,
): Queryable {
  async function query<T extends QueryResultRow>(text: string, params?: unknown[]) {
    return (await run(text, params)) as T[];
  }
  async function queryOne<T extends QueryResultRow>(text: string, params?: unknown[]) {
    return (await query<T>(text, params))[0] ?? null;
  }
  return { query, queryOne };
}

export const db: Queryable = queryable(async (text, params) => {
  const result = await getPool().query(text, params);
  return result.rows;
});

/**
 * Ejecuta `fn` en una transacción. Si se indica `actorId`, queda registrado
 * como autor de los cambios en audit_logs (los triggers leen app.user_id).
 * Toda escritura sobre tablas auditadas debe pasar por aquí.
 */
export async function transaction<T>(
  actorId: string | null,
  fn: (tx: Queryable) => Promise<T>,
): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query("begin");
    if (actorId) {
      await client.query("select set_config('app.user_id', $1, true)", [actorId]);
    }
    const tx = queryable(async (text, params) => (await client.query(text, params)).rows);
    const result = await fn(tx);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function dbErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

export function dbErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido de la base de datos.";
}

export const UNIQUE_VIOLATION = "23505";
