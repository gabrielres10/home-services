export function floorDisplayName(
  name: string,
  occupantName?: string | null,
): string {
  const occupant = occupantName?.trim();
  if (!occupant) {
    return name;
  }
  return `${name} · ${occupant}`;
}
