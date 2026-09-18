"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { createPeriod } from "@/app/actions/periods";
import { periodLabelFromDates } from "@/lib/domain/period-label";
import { SubmitButton } from "@/components/submit-button";
import { DateInput } from "@/components/date-input";

export function PeriodForm({
  isFirst = false,
  lastPeriodLabel = null,
  suggestedStartsOn = null,
  suggestedEndsOn = null,
}: {
  isFirst?: boolean;
  lastPeriodLabel?: string | null;
  suggestedStartsOn?: string | null;
  suggestedEndsOn?: string | null;
}) {
  const [startsOn, setStartsOn] = useState(suggestedStartsOn ?? "");
  const [endsOn, setEndsOn] = useState(suggestedEndsOn ?? "");
  const label = useMemo(
    () => periodLabelFromDates(startsOn, endsOn),
    [startsOn, endsOn],
  );
  const hasSuggestion = Boolean(suggestedStartsOn && suggestedEndsOn && lastPeriodLabel);

  return (
    <ActionForm action={createPeriod} className="stack-lg">
      {isFirst ? (
        <p className="notice notice-info">
          Es el primer período de la casa. Usa las fechas de las lecturas más
          antiguas que tengas (pueden ser de una planilla). Eso deja la referencia.
          El recibo se liquida en el período siguiente.
        </p>
      ) : hasSuggestion ? (
        <p className="notice notice-warning">
          Sugiero el día siguiente al último período ({lastPeriodLabel}) y 30 días
          después. Es solo una guía: revisa que coincidan con las lecturas y el
          recibo que vas a registrar. EMCALI no usa un mes calendario fijo.
        </p>
      ) : (
        <p className="notice">
          Un período va de una fecha de lectura a la siguiente. No tiene que ser un
          mes calendario. Si el día coincide (por ejemplo, ambos el 11 feb), el
          anterior es el que empieza antes.
        </p>
      )}
      <label className="field">
        <span className="field-label">Fecha inicial</span>
        <DateInput
          name="starts_on"
          required
          value={startsOn}
          onChange={(event) => setStartsOn(event.target.value)}
        />
        <span className="help-line">
          El día de la lectura con la que empieza este período.
        </span>
      </label>
      <label className="field">
        <span className="field-label">Fecha final</span>
        <DateInput
          name="ends_on"
          required
          value={endsOn}
          onChange={(event) => setEndsOn(event.target.value)}
        />
        <span className="help-line">
          El día de la lectura con la que termina. Suele ser el del recibo.
        </span>
      </label>
      <p className="period-name-preview">
        <span className="kicker">Así se va a llamar</span>
        <strong className={label ? undefined : "type-display-placeholder"}>
          {label ?? "Elige las dos fechas para ver el nombre."}
        </strong>
      </p>
      <div>
        <p className="save-hint">
          Si las fechas se ven bien, pulsa el botón. Después entrarás a cargar el
          recibo y las lecturas.
        </p>
        <SubmitButton pendingLabel="Creando…">Crear período</SubmitButton>
      </div>
    </ActionForm>
  );
}
