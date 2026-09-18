"use client";

import { useEffect, useState } from "react";

export function PhotoPicker({
  name = "photo",
  required = true,
  disabled = false,
  title = "Fotografía del contador",
  hint = "Pulsa el botón verde y elige la foto que tomaste al medidor.",
  alt = "Vista previa de la fotografía del contador",
}: {
  name?: string;
  required?: boolean;
  disabled?: boolean;
  title?: string;
  hint?: string;
  alt?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setFileLabel(null);

    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Elige una fotografía. Ese archivo no es una imagen.");
      setPreviewUrl(null);
      event.target.value = "";
      return;
    }

    setFileLabel(file.name);
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <div className="file-drop file-drop-compact">
      <p className="file-drop-title">{title}</p>
      <p className="muted text-[0.86rem]">{hint}</p>
      <input
        name={name}
        type="file"
        accept="image/*"
        required={required}
        disabled={disabled}
        onChange={onChange}
        className="input-control file-control"
      />
      {error ? <p className="notice notice-error">{error}</p> : null}
      {previewUrl ? (
        <figure className="photo-preview">
          {/* Vista local, todavía no se sube. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={alt} />
          <figcaption>
            Así se ve la foto. Todavía no se ha guardado: mira si se lee el número
            del contador. Si está bien, envía la lectura
            {fileLabel ? ` (${fileLabel})` : ""}.
          </figcaption>
        </figure>
      ) : (
        <p className="muted text-[0.82rem]">
          Cuando elijas la foto, aparecerá aquí para que la revises antes de
          enviarla.
        </p>
      )}
    </div>
  );
}
