export function periodDeleteConfirmationError(input: {
  confirmed: boolean;
  typedLabel: string;
  periodLabel: string;
}): string | null {
  if (!input.confirmed) {
    return "Marca la casilla para confirmar que quieres eliminar el período.";
  }
  if (input.typedLabel.trim() !== input.periodLabel) {
    return "Escribe el nombre del período exactamente como aparece para poder eliminarlo.";
  }
  return null;
}
