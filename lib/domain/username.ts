export const AUTH_USERNAME_DOMAIN = "vivienda.local";

const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

export function normalizeUsername(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  return at === -1 ? trimmed : trimmed.slice(0, at);
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function parseUsername(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = normalizeUsername(raw);
  if (!value) {
    return { ok: false, message: "Introduce tu usuario." };
  }
  if (!isValidUsername(value)) {
    return {
      ok: false,
      message:
        "El usuario debe empezar por una letra y solo puede tener letras, números, guion o guion bajo.",
    };
  }
  return { ok: true, value };
}

export function emailForUsername(username: string): string {
  return `${username}@${AUTH_USERNAME_DOMAIN}`;
}
