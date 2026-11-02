const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Los ids llegan en formularios: PostgreSQL falla con un error (no con "sin
// resultados") si un uuid mal formado llega a una consulta.
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
