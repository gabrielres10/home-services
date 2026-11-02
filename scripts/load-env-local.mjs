import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mismos archivos y precedencia que Next.js: el entorno manda sobre
// .env.local, y este sobre .env. Si ninguno existe no pasa nada:
// DATABASE_URL puede venir del entorno.
const ENV_FILES = [".env.local", ".env"];

function readEnvFile(name) {
  let text;
  try {
    text = readFileSync(resolve(process.cwd(), name), "utf8");
  } catch {
    return;
  }

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function loadEnvLocal() {
  for (const name of ENV_FILES) {
    readEnvFile(name);
  }
}
