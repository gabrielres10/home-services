"use client";

import { ActionForm } from "@/components/action-form";
import { signIn } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm() {
  return (
    <ActionForm action={signIn} className="stack-md">
      <label className="field">
        <span className="field-label">Correo</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input-control"
        />
      </label>
      <label className="field">
        <span className="field-label">Contraseña</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input-control"
        />
      </label>
      <SubmitButton full pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </ActionForm>
  );
}
