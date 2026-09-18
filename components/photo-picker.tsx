"use client";

import { useEffect, useState } from "react";

export function PhotoPicker({
  name = "photo",
  required = true,
  disabled = false,
  title = "Fotografía del contador",
  onPreviewChange,
}: {
  name?: string;
  required?: boolean;
  disabled?: boolean;
  title?: string;
  onPreviewChange?: (url: string | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

    if (!file) {
      setPreviewUrl(null);
      onPreviewChange?.(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Elige una fotografía. Ese archivo no es una imagen.");
      setPreviewUrl(null);
      onPreviewChange?.(null);
      event.target.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onPreviewChange?.(url);
  }

  return (
    <div className="file-drop file-drop-compact">
      <p className="file-drop-title">{title}</p>
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
    </div>
  );
}
