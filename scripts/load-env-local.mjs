import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  let text;
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    throw new Error("No encontré .env.local en la raíz del proyecto.");
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
