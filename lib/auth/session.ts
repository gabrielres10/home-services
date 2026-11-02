import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db/pool";
import { SESSION_COOKIE, SESSION_DAYS } from "./session-cookie";
import { hashSessionToken, newSessionToken } from "./session-token";

// La cookie solo lleva Secure si la petición llegó por HTTPS (directa o tras
// un proxy). Con Secure forzado, un despliegue por HTTP en red local nunca
// guardaría la sesión y el login fallaría sin mensaje.
async function requestIsHttps(): Promise<boolean> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) {
    return forwarded === "https";
  }
  return requestHeaders.get("origin")?.startsWith("https://") ?? false;
}

export async function createSession(userId: string): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.query("delete from user_sessions where expires_at < now()");
  await db.query(
    "insert into user_sessions (user_id, token_hash, expires_at) values ($1, $2, $3)",
    [userId, hashSessionToken(token), expiresAt],
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await requestIsHttps(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function destroySession(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    await db.query("delete from user_sessions where token_hash = $1", [
      hashSessionToken(token),
    ]);
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
