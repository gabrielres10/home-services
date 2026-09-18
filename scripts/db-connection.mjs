import { loadEnvLocal } from "./load-env-local.mjs";

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    const [ref] = host.split(".");
    return ref || null;
  } catch {
    return null;
  }
}

export function getDatabaseUrl() {
  loadEnvLocal();

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const password = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ref = supabaseUrl ? projectRefFromUrl(supabaseUrl) : null;

  if (password && ref) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
  }

  return null;
}

export function requireDatabaseUrl() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL en .env.local (URI del Session pooler).",
    );
  }
  return url;
}
