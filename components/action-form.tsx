"use client";

import { useActionState } from "react";

type ActionResult = { error: string } | null;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<{ error: string } | void>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(
    async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
      const result = await action(formData);
      if (result && "error" in result && result.error) {
        return { error: result.error };
      }
      return null;
    },
    null,
  );

  return (
    <form action={formAction} className={className}>
      {state?.error ? (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.error}
        </p>
      ) : null}
      {children}
    </form>
  );
}
