"use client";

import { useId, useState } from "react";

export function FilePicker({
  name,
  accept,
  required = false,
  disabled = false,
  buttonLabel,
  emptyLabel = "Ningún archivo elegido",
  onFile,
}: {
  name: string;
  accept: string;
  required?: boolean;
  disabled?: boolean;
  buttonLabel: string;
  emptyLabel?: string;
  onFile?: (file: File | null) => void;
}) {
  const id = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className={`file-picker${disabled ? " is-disabled" : ""}`}>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        disabled={disabled}
        className="file-picker-input"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setFileName(file?.name ?? null);
          onFile?.(file);
        }}
      />
      <label htmlFor={id} className="file-picker-button">
        {buttonLabel}
      </label>
      <span className={`file-picker-name${fileName ? " has-file" : ""}`}>
        {fileName ?? emptyLabel}
      </span>
    </div>
  );
}
