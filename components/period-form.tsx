"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { createPeriod } from "@/app/actions/periods";
import { periodLabelFromDates } from "@/lib/domain/period-label";
import { SubmitButton } from "@/components/submit-button";

export function PeriodForm() {
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const label = useMemo(
    () => periodLabelFromDates(startsOn, endsOn),
    [startsOn, endsOn],
  );

  return (
    <ActionForm action={createPeriod} className="stack-lg">
      <label className="field">
        <span className="field-label">Fecha inicial</span>
        <input
          name="starts_on"
          type="date"
          required
          value={startsOn}
          onChange={(event) => setStartsOn(event.target.value)}
          className="input-control"
        />
      </label>
      <label className="field">
        <span className="field-label">Fecha final</span>
        <input
          name="ends_on"
          type="date"
          required
          value={endsOn}
          onChange={(event) => setEndsOn(event.target.value)}
          className="input-control"
        />
      </label>
      <p className="period-name-preview">
        <span className="kicker">Nombre del período</span>
        <strong className={label ? undefined : "type-display-placeholder"}>
          {label ?? "Se genera con las fechas inicial y final."}
        </strong>
      </p>
      <p className="muted text-[0.92rem]">
        El período con la fecha inicial más antigua guarda las lecturas de referencia.
        El consumo se calcula a partir del siguiente. Si el día de lectura coincide
        (por ejemplo, un período termina el 11 feb y el siguiente empieza el 11 feb),
        el anterior es el que empieza antes.
      </p>
      <SubmitButton pendingLabel="Creando…">Crear período</SubmitButton>
    </ActionForm>
  );
}
