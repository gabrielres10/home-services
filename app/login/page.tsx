import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (!getSupabaseEnv()) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
        <h1 className="text-2xl font-semibold">Servicios de la vivienda</h1>
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Faltan las variables NEXT_PUBLIC_SUPABASE_URL y
          NEXT_PUBLIC_SUPABASE_ANON_KEY. Cópialas en .env.local. Ver el README.
        </p>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/mis-lecturas");
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold">Servicios de la vivienda</h1>
      <p className="mt-2 mb-6 text-stone-600">
        Inicia sesión para registrar o revisar lecturas.
      </p>
      <LoginForm />
    </main>
  );
}
