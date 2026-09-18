"use client";

import { ActionForm } from "@/components/action-form";
import { markPeriodReady, reopenPeriod } from "@/app/actions/periods";

export function PeriodActions({
  periodId,
  status,
  canMarkReady,
  settlementMessage,
}: {
  periodId: string;
  status: "open" | "ready" | "closed";
  canMarkReady: boolean;
  settlementMessage: string | null;
}) {
  return (
    <div className="space-y-3">
      {status === "open" ? (
        <ActionForm
          action={async (formData) => {
            void formData;
            return markPeriodReady(periodId);
          }}
        >
          <button
            type="submit"
            disabled={!canMarkReady}
            className="rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            Marcar período como listo
          </button>
        </ActionForm>
      ) : null}
      {status === "ready" ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled
            title={settlementMessage ?? undefined}
            className="rounded bg-stone-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            Preparar liquidación
          </button>
          {settlementMessage ? (
            <p className="text-sm text-stone-600">{settlementMessage}</p>
          ) : null}
          <ActionForm
            action={async (formData) => {
              void formData;
              return reopenPeriod(periodId);
            }}
          >
            <button
              type="submit"
              className="rounded border border-stone-300 px-4 py-2 text-stone-700 hover:bg-stone-50"
            >
              Reabrir período
            </button>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
