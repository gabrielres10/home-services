"use client";

function openDatePicker(input: HTMLInputElement) {
  if (input.disabled || typeof input.showPicker !== "function") {
    return;
  }
  try {
    input.showPicker();
  } catch {
    /* Ya está abierto o el navegador no lo permite. */
  }
}

export function DateInput({
  name,
  value,
  defaultValue,
  required = false,
  disabled = false,
  className = "input-control",
  onChange,
}: {
  name: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      name={name}
      type="date"
      required={required}
      disabled={disabled}
      className={className}
      {...(value !== undefined ? { value } : { defaultValue })}
      onChange={onChange}
      onPointerDown={(event) => {
        if (event.button !== 0 || event.currentTarget.disabled) {
          return;
        }
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        openDatePicker(event.currentTarget);
      }}
    />
  );
}
