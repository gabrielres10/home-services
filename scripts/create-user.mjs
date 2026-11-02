import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { createClient, describeError, explainConnectionError } from "./db-connection.mjs";

const scryptAsync = promisify(scrypt);

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

Necesitas DATABASE_URL en .env.local y haber corrido npm run db:schema.`);
}

function normalizeUsername(raw) {
  const trimmed = String(raw ?? "").trim().toLowerCase();
  const at = trimmed.indexOf("@");
  return at === -1 ? trimmed : trimmed.slice(0, at);
}

// Mismo formato que lib/auth/password.ts: scrypt$N$r$p$sal$hash (base64).
async function hashPassword(password) {
  const cost = 2 ** 15;
  const blockSize = 8;
  const parallelism = 1;
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, {
    N: cost,
    r: blockSize,
    p: parallelism,
    maxmem: 256 * cost * blockSize,
  });
  return ["scrypt", cost, blockSize, parallelism, salt.toString("base64"), key.toString("base64")].join("$");
}

async function findExistingUser(client, spec, username) {
  const byUsername = await client.query("select id from users where username = $1", [username]);
  if (byUsername.rows[0]) {
    return byUsername.rows[0].id;
  }

  if (spec.role === "admin") {
    const admin = await client.query("select id from users where role = 'admin' limit 1");
    if (admin.rows[0]) {
      return admin.rows[0].id;
    }
  }

  if (spec.floorCode) {
    const member = await client.query(
      `select m.user_id
       from floor_memberships m
       join floors f on f.id = m.floor_id
       where f.code = $1`,
      [spec.floorCode],
    );
    if (member.rows[0]) {
      return member.rows[0].user_id;
    }
  }

  return null;
}

async function main() {
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

  const fullName = fullNameArg || spec.defaultName;
  const passwordHash = await hashPassword(password);

  const client = createClient();
  await client.connect();
  try {
    await client.query("begin");

    let floorId = null;
    if (spec.floorCode) {
      const floor = await client.query("select id from floors where code = $1", [spec.floorCode]);
      floorId = floor.rows[0]?.id ?? null;
      if (!floorId) {
        throw new Error(
          `No encontré el piso ${spec.floorCode}. ¿Ejecutaste npm run db:schema?`,
        );
      }
    }

    let userId = await findExistingUser(client, spec, username);
    const created = userId === null;

    if (created) {
      const inserted = await client.query(
        `insert into users (username, full_name, role, password_hash)
         values ($1, $2, $3, $4)
         returning id`,
        [username, fullName, spec.role, passwordHash],
      );
      userId = inserted.rows[0].id;
    } else {
      await client.query(
        `update users
         set username = $2, full_name = $3, role = $4, password_hash = $5
         where id = $1`,
        [userId, username, fullName, spec.role, passwordHash],
      );
      // Cambiar la contraseña cierra las sesiones abiertas de esa cuenta.
      await client.query("delete from user_sessions where user_id = $1", [userId]);
    }

    if (floorId) {
      await client.query(
        `insert into floor_memberships (user_id, floor_id)
         values ($1, $2)
         on conflict (user_id) do update set floor_id = excluded.floor_id`,
        [userId, floorId],
      );
    }

    await client.query("commit");

    console.log(created ? "Usuario creado." : "El usuario ya existía; se actualizó.");
    console.log(`Usuario: ${username}`);
    console.log(`Nombre:  ${fullName}`);
    console.log(`Rol:     ${spec.role}`);
    console.log(`Piso:    ${spec.floorCode ?? "(ninguno)"}`);
    console.log(`ID:      ${userId}`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = describeError(error);
  console.error(message);
  explainConnectionError(message);
  process.exit(1);
});
