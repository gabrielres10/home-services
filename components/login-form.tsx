"use client";

import { ActionForm } from "@/components/action-form";
import { signIn } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm() {
  return (
    <ActionForm action={signIn} className="stack-md">
      <label className="field">
        <span className="field-label">Usuario</span>
        <input
          name="username"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
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
