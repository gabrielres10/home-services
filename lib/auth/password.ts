import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  cost: number,
  blockSize: number,
  parallelism: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N: cost, r: blockSize, p: parallelism, maxmem: 256 * cost * blockSize },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

// Formato: scrypt$N$r$p$sal$hash (base64). Los parámetros viajan con el hash,
// así se pueden subir más adelante sin invalidar las contraseñas existentes.
// scripts/create-user.mjs genera el mismo formato.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, COST, BLOCK_SIZE, PARALLELISM);
  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, blockSize, parallelism, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !cost || !blockSize || !parallelism || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64");
  try {
    const actual = await derive(
      password,
      Buffer.from(salt, "base64"),
      expected.length,
      Number(cost),
      Number(blockSize),
      Number(parallelism),
    );
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
