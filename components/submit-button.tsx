"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  variant = "primary",
  pendingLabel = "Enviando…",
  disabled,
  busy,
  title,
  full,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "approve" | "reject";
  pendingLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  full?: boolean;
}) {
  const { pending } = useFormStatus();
  const waiting = pending || Boolean(busy);

  return (
    <button
      type="submit"
      disabled={disabled || waiting}
      title={title}
      className={`btn btn-${variant}${full ? " btn-full" : ""}`}
    >
      {waiting ? pendingLabel : children}
    </button>
  );
}
