import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

const AUTH_USERNAME_DOMAIN = "vivienda.local";
const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

const ROLES = {
  admin: {
    role: "admin",
    floorCode: null,
    defaultName: "Administrador",
  },
  "piso-1": {
    role: "floor_user",
    floorCode: "piso-1",
    defaultName: "Nasly",
  },
  "piso-2": {
    role: "floor_user",
    floorCode: "piso-2",
    defaultName: "Lucy",
  },
};

function usage() {
  console.error(`Uso:
  npm run user:admin -- usuario "Contraseña"
  npm run user:piso-1 -- usuario "Contraseña"
  npm run user:piso-2 -- usuario "Contraseña"

Nombre opcional:
  npm run user:piso-1 -- nasly "Contraseña" "Nasly"

Necesitas SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) en .env.local.
Es la clave secret / service_role del dashboard, no la anon.`);
}

function normalizeUsername(raw) {
  const trimmed = String(raw ?? "").trim().toLowerCase();
  const at = trimmed.indexOf("@");
  return at === -1 ? trimmed : trimmed.slice(0, at);
}

function emailForUsername(username) {
  return `${username}@${AUTH_USERNAME_DOMAIN}`;
}

function isDuplicateUserError(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("user already exists")
  );
}

async function findUserByEmail(supabase, email) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`No pude listar usuarios: ${error.message}`);
    }
    const found = data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) {
      return found;
    }
    if (data.users.length < perPage) {
      return null;
    }
    page += 1;
  }

  return null;
}

async function userById(supabase, id) {
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data?.user) {
    return null;
  }
  return data.user;
}

async function findExistingAccount(supabase, spec, username, syntheticEmail) {
  const { data: byUsername } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (byUsername?.id) {
    const found = await userById(supabase, byUsername.id);
    if (found) {
      return found;
    }
  }

  const bySynthetic = await findUserByEmail(supabase, syntheticEmail);
  if (bySynthetic) {
    return bySynthetic;
  }

  if (spec.role === "admin") {
    const { data: admin } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (admin?.id) {
      const found = await userById(supabase, admin.id);
      if (found) {
        return found;
      }
    }
  }

  if (spec.floorCode) {
    const { data: floor } = await supabase
      .from("floors")
      .select("id")
      .eq("code", spec.floorCode)
      .maybeSingle();
    if (floor?.id) {
      const { data: membership } = await supabase
        .from("floor_memberships")
        .select("user_id")
        .eq("floor_id", floor.id)
        .maybeSingle();
      if (membership?.user_id) {
        const found = await userById(supabase, membership.user_id);
        if (found) {
          return found;
        }
      }
    }
  }

  return null;
}

async function main() {
  loadEnvLocal();

  const kind = process.argv[2];
  const username = normalizeUsername(process.argv[3] ?? "");
  const password = process.argv[4];
  const fullNameArg = process.argv[5]?.trim();

  const spec = kind ? ROLES[kind] : undefined;
  if (!spec || !username || !password) {
    usage();
    process.exit(1);
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      "El usuario debe empezar por una letra y solo puede tener letras, números, guion o guion bajo.",
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local.");
  }
  if (!serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local. Añade la Secret key (sb_secret_...) o la legacy service_role. No uses la anon/publishable.",
    );
  }

  if (!serviceKey.startsWith("eyJ") && !serviceKey.startsWith("sb_secret_")) {
    console.warn(
      "Aviso: esa clave no parece service_role ni secret. No uses la anon/publishable para este comando.",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const fullName = fullNameArg || spec.defaultName;
  const email = emailForUsername(username);
  let user = await findExistingAccount(supabase, spec, username, email);
  let created = false;

  if (user) {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username },
    });
    if (passwordError) {
      throw new Error(`El usuario existe, pero no pude actualizarlo: ${passwordError.message}`);
    }
  } else {
    const createdResult = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username },
    });
    if (createdResult.error) {
      if (!isDuplicateUserError(createdResult.error.message)) {
        throw new Error(`No se pudo crear el usuario: ${createdResult.error.message}`);
      }
      user = await findUserByEmail(supabase, email);
      if (!user) {
        throw new Error(
          "Ese usuario ya existe en Auth, pero no pude obtener su id. Revísalo en Authentication → Users.",
        );
      }
      const { error: passwordError } = await supabase.auth.admin.updateUserById(user.id, {
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, username },
      });
      if (passwordError) {
        throw new Error(`El usuario existe, pero no pude actualizarlo: ${passwordError.message}`);
      }
    } else {
      user = createdResult.data.user;
      created = true;
    }
  }

  if (!user) {
    throw new Error("Supabase no devolvió el usuario.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    role: spec.role,
    username,
  });
  if (profileError) {
    throw new Error(
      `Usuario creado en Auth, pero falló el perfil: ${profileError.message}`,
    );
  }

  if (spec.floorCode) {
    const { data: floor, error: floorError } = await supabase
      .from("floors")
      .select("id, name")
      .eq("code", spec.floorCode)
      .maybeSingle();
    if (floorError || !floor) {
      throw new Error(
        `No encontré el piso ${spec.floorCode}. ¿Ejecutaste supabase/migrations/001_schema.sql?`,
      );
    }
    const { error: membershipError } = await supabase.from("floor_memberships").upsert({
      user_id: user.id,
      floor_id: floor.id,
    });
    if (membershipError) {
      throw new Error(`No se pudo asociar el piso: ${membershipError.message}`);
    }
  }

  console.log(created ? "Usuario creado." : "El usuario ya existía; se actualizó.");
  console.log(`Usuario: ${username}`);
  console.log(`Nombre:  ${fullName}`);
  console.log(`Rol:     ${spec.role}`);
  console.log(`Piso:    ${spec.floorCode ?? "(ninguno)"}`);
  console.log(`UUID:    ${user.id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
