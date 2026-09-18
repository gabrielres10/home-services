"use client";

import { ActionForm } from "@/components/action-form";
import { signIn } from "@/app/actions/auth";

export function LoginForm() {
  return (
    <ActionForm action={signIn} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-stone-700">Correo</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-700">Contraseña</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-800"
      >
        Entrar
      </button>
    </ActionForm>
  );
}
