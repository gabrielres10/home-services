import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { LoginForm } from "@/components/login-form";
import { HouseMark } from "@/components/ui";

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-screen">
      <div className="auth-frame">
        <div className="auth-identity">
          <HouseMark size="lg" />
          <h1>Servicios de la vivienda</h1>
          {children}
        </div>
        <div className="auth-panel">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

export default async function LoginPage() {
  if (!getSupabaseEnv()) {
    return (
      <main className="auth-screen">
        <div className="auth-frame auth-frame-solo">
          <div className="auth-identity">
            <HouseMark size="lg" />
            <h1>Servicios de la vivienda</h1>
            <div className="notice notice-error mt-6 max-w-[36ch]">
              Faltan las variables NEXT_PUBLIC_SUPABASE_URL y
              NEXT_PUBLIC_SUPABASE_ANON_KEY. Cópialas en .env.local. Ver el README.
            </div>
          </div>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/mis-lecturas");
  }

  return (
    <LoginShell>
      <p>Inicia sesión para registrar o revisar lecturas.</p>
    </LoginShell>
  );
}
