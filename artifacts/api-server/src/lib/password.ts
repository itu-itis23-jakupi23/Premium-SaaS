import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("base64url");
  return `scrypt:v1:${salt}:${derived}`;
}

export function verifyPassword(password: string, hash: string) {
  const [algorithm, version, salt, derived] = hash.split(":");

  if (algorithm !== "scrypt" || version !== "v1" || !salt || !derived) {
    return false;
  }

  const expected = Buffer.from(derived, "base64url");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
