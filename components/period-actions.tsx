"use client";

import { ActionForm } from "@/components/action-form";
import { closePeriod, markPeriodReady, reopenPeriod } from "@/app/actions/periods";
import { SubmitButton } from "@/components/submit-button";

export function PeriodActions({
  periodId,
  status,
  canMarkReady,
  canClose,
  closeBlockedMessage,
}: {
  periodId: string;
  status: "open" | "ready" | "closed";
  canMarkReady: boolean;
  canClose: boolean;
  closeBlockedMessage: string | null;
}) {
  return (
    <div className="stack-md">
      {status === "open" ? (
        <ActionForm
          action={async (formData) => {
            void formData;
            return markPeriodReady(periodId);
          }}
        >
          <div className="action-bar">
            <SubmitButton disabled={!canMarkReady} pendingLabel="Marcando…">
              Marcar período como listo
            </SubmitButton>
          </div>
        </ActionForm>
      ) : null}
      {status === "ready" ? (
        <div className="stack-md">
          <ActionForm
            action={async (formData) => {
              void formData;
              return closePeriod(periodId);
            }}
          >
            <div className="action-bar">
              <SubmitButton
                disabled={!canClose}
                title={closeBlockedMessage ?? undefined}
                pendingLabel="Cerrando…"
              >
                Cerrar período
              </SubmitButton>
            </div>
          </ActionForm>
          {closeBlockedMessage ? (
            <p className="muted text-[0.92rem]">{closeBlockedMessage}</p>
          ) : null}
          <ActionForm
            action={async (formData) => {
              void formData;
              return reopenPeriod(periodId);
            }}
          >
            <SubmitButton variant="ghost" pendingLabel="Reabriendo…">
              Reabrir período
            </SubmitButton>
          </ActionForm>
        </div>
      ) : null}
      {status === "closed" ? (
        <ActionForm
          action={async (formData) => {
            void formData;
            return reopenPeriod(periodId);
          }}
        >
          <p className="muted text-[0.92rem]">
            El período está cerrado. El recibo y las lecturas no se pueden cambiar
            hasta reabrirlo.
          </p>
          <div className="action-bar">
            <SubmitButton variant="ghost" pendingLabel="Reabriendo…">
              Reabrir período
            </SubmitButton>
          </div>
        </ActionForm>
      ) : null}
    </div>
  );
}
