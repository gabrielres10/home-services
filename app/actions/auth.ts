"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { emailForUsername, parseUsername } from "@/lib/domain/username";

export async function signIn(formData: FormData): Promise<{ error: string } | void> {
  const parsed = parseUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!parsed.ok) {
    return { error: parsed.message };
  }
  if (!password) {
    return { error: "Introduce usuario y contraseña." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: storedEmail } = await supabase.rpc("auth_email_for_username", {
    p_username: parsed.value,
  });
  const email = storedEmail || emailForUsername(parsed.value);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "No se pudo iniciar sesión. Verifica el usuario y la contraseña." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
