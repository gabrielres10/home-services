"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { closePeriod, deletePeriod, markPeriodReady, reopenPeriod } from "@/app/actions/periods";
import { SubmitButton } from "@/components/submit-button";

export function PeriodActions({
  periodId,
  periodLabel,
  status,
  canMarkReady,
  canClose,
  closeBlockedMessage,
}: {
  periodId: string;
  periodLabel: string;
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
          {canMarkReady ? (
            <p className="notice notice-info">
              Recibo y lecturas ya están. Si revisaste las fotos, marca el período
              como listo.
            </p>
          ) : (
            <p className="notice">
              Este botón se activa cuando el recibo esté guardado y las lecturas de
              Piso 1 y Piso 2 estén aprobadas. Completa los pasos de arriba.
            </p>
          )}
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
            {canClose ? (
              <p className="notice notice-info">
                Si ya viste cuánto paga cada piso y está bien, cierra el período.
              </p>
            ) : null}
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
      <DeletePeriodForm periodId={periodId} periodLabel={periodLabel} />
    </div>
  );
}

function DeletePeriodForm({
  periodId,
  periodLabel,
}: {
  periodId: string;
  periodLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="danger-panel">
        <p className="muted text-[0.92rem]">
          Si este período sobra o quedó mal creado, puedes eliminarlo. Es
          irreversible.
        </p>
        <div className="action-bar">
          <button type="button" className="btn btn-reject" onClick={() => setConfirming(true)}>
            Eliminar período
          </button>
        </div>
      </div>
    );
  }

  return (
    <ActionForm action={deletePeriod} className="danger-panel stack-md">
      <input type="hidden" name="period_id" value={periodId} />
      <p className="notice notice-warning">
        Se borra {periodLabel}: el recibo, las lecturas y las fotos. No se puede
        deshacer. Si hay períodos después, su consumo puede quedar mal porque
        usaban estas lecturas como anterior.
      </p>
      <label className="field">
        <span className="field-label">Escribe el nombre del período para confirmar</span>
        <input
          name="confirm_label"
          required
          autoComplete="off"
          spellCheck={false}
          className="input-control"
          placeholder={periodLabel}
        />
      </label>
      <label className="flex items-start gap-2 text-[0.9rem]">
        <input type="checkbox" name="confirm_delete" required className="mt-1" />
        <span>Entiendo que esta acción no se puede deshacer.</span>
      </label>
      <div className="action-bar">
        <SubmitButton variant="reject" pendingLabel="Eliminando…">
          Eliminar de verdad
        </SubmitButton>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
          Cancelar
        </button>
      </div>
    </ActionForm>
  );
}
