export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : null;
}

// pg no avisa si la URL está mal escrita: usa localhost:5432 por defecto y el
// error parece un problema de red. Por eso se valida antes de conectar.
function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "postgresql:" || url.protocol === "postgres:") && url.hostname !== "";
  } catch {
    return false;
  }
}

export function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("Falta la variable DATABASE_URL.");
  }
  if (!isPostgresUrl(url)) {
    throw new Error(
      "DATABASE_URL no tiene un formato válido. Debe verse así: postgresql://usuario:contraseña@host:5432/base " +
        "(revisa que no haya texto repetido al principio).",
    );
  }
  return url;
}
