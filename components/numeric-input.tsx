"use client";

import { useState } from "react";
import {
  explainNumericReject,
  formatGroupedFromRaw,
  isNumericDraft,
  parseNumericRaw,
} from "@/lib/domain/numeric";

export function NumericInput({
  name,
  defaultValue = "",
  required = false,
  disabled = false,
  kind = "quantity",
  className = "input-control input-figure",
  onValueChange,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  kind?: "quantity" | "money";
  className?: string;
  onValueChange?: (raw: string) => void;
}) {
  const [raw, setRaw] = useState(defaultValue);
  const [hint, setHint] = useState<string | null>(null);
  const parsed = parseNumericRaw(raw);
  const preview = formatGroupedFromRaw(raw, kind);
  const negative = parsed !== null && parsed < 0;

  function reject(next: string) {
    setHint(explainNumericReject(next));
  }

  function accept(next: string) {
    setRaw(next);
    setHint(null);
    onValueChange?.(next);
  }

  function onBeforeInput(event: React.InputEvent<HTMLInputElement>) {
    const inputType =
      "inputType" in event.nativeEvent &&
      typeof event.nativeEvent.inputType === "string"
        ? event.nativeEvent.inputType
        : "";
    if (inputType.startsWith("delete") || inputType.startsWith("history")) {
      return;
    }

    const inserted = event.data ?? "";
    const input = event.currentTarget;
    const start = input.selectionStart ?? raw.length;
    const end = input.selectionEnd ?? raw.length;
    const next = raw.slice(0, start) + inserted + raw.slice(end);
    if (!isNumericDraft(next)) {
      event.preventDefault();
      reject(next || inserted);
    }
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    if (isNumericDraft(next)) {
      accept(next);
      return;
    }
    reject(next);
  }

  function onPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    const input = event.currentTarget;
    const start = input.selectionStart ?? raw.length;
    const end = input.selectionEnd ?? raw.length;
    const next = raw.slice(0, start) + pasted + raw.slice(end);
    if (!isNumericDraft(next)) {
      event.preventDefault();
      reject(next);
    }
  }

  return (
    <div className="numeric-field">
      <input
        name={name}
        value={raw}
        required={required}
        disabled={disabled}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        pattern={"^-?\\d+(,\\d+)?$|^$"}
        title="Solo dígitos, coma decimal y un menos al inicio si es negativo"
        onBeforeInput={onBeforeInput}
        onChange={onChange}
        onPaste={onPaste}
        className={`${className}${negative ? " is-negative" : ""}`}
      />
      {preview ? (
        <p className={`numeric-preview${negative ? " is-negative" : ""}`}>{preview}</p>
      ) : null}
      {hint ? (
        <p className="numeric-hint" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
