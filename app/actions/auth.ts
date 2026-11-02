"use server";

import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { db } from "@/lib/db/pool";
import { parseUsername } from "@/lib/domain/username";

// Se compara contra un hash cualquiera cuando el usuario no existe, para que
// "usuario inexistente" y "contraseña incorrecta" tarden lo mismo.
let fallbackHash: Promise<string> | null = null;

export async function signIn(formData: FormData): Promise<{ error: string } | void> {
  const parsed = parseUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!parsed.ok) {
    return { error: parsed.message };
  }
  if (!password) {
    return { error: "Introduce usuario y contraseña." };
  }

  let userId: string | null;
  try {
    const user = await db.queryOne<{ id: string; password_hash: string }>(
      "select id, password_hash from users where username = $1",
      [parsed.value],
    );
    fallbackHash ??= hashPassword("sin-usuario");
    const valid = await verifyPassword(password, user?.password_hash ?? (await fallbackHash));
    userId = user && valid ? user.id : null;

    if (userId) {
      await createSession(userId);
    }
  } catch (error) {
    console.error("No se pudo iniciar sesión:", error);
    return { error: "No se pudo conectar con la base de datos. Revisa DATABASE_URL." };
  }

  if (!userId) {
    return { error: "No se pudo iniciar sesión. Verifica el usuario y la contraseña." };
  }

  redirect("/");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}
