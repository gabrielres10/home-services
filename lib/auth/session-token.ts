import { createHash, randomBytes } from "node:crypto";

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

// En la base solo se guarda el hash: con la tabla filtrada no se pueden
// reconstruir las cookies de las sesiones activas.
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
