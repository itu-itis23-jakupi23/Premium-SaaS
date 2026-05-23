import { createHmac, randomBytes } from "node:crypto";

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  org: string;
  role: string;
  exp: number;
}

export function createRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token: string) {
  return createHmac("sha256", getAuthSecret()).update(token).digest("base64url");
}

export function signAccessToken(payload: AccessTokenPayload) {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) return null;

  const expected = sign(`${header}.${body}`);
  if (signature !== expected) return null;

  const payload = decode<AccessTokenPayload>(body);
  if (!payload || payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload;
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET environment variable is required in production.");
  }

  return "local-dev-auth-secret-change-before-production";
}
