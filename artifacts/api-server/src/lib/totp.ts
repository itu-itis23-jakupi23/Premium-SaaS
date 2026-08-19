import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// RFC 6238 TOTP (time-based one-time passwords) implemented with node:crypto so
// the workspace pulls in no additional dependency. Secrets are AES-256-GCM
// encrypted at rest with a key derived from AUTH_SECRET; the login challenge
// token is a stateless HMAC-signed blob, mirroring lib/tokens.ts.
// ─────────────────────────────────────────────────────────────────────────────

const DIGITS = 6;
const PERIOD_SECONDS = 30;
const ISSUER = "ENS Platform";

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET environment variable is required in production.");
  }
  return "local-dev-auth-secret-change-before-production";
}

// ── Base32 (RFC 4648, no padding) — the encoding authenticator apps expect ──
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ── Secret generation + otpauth:// URI for QR codes / manual entry ──
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAuthUri(secret: string, accountLabel: string): string {
  const label = encodeURIComponent(`${ISSUER}:${accountLabel}`);
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── The core HOTP/TOTP computation ──
function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/**
 * Verify a 6-digit code against the secret, allowing ±1 time step (30s) of
 * clock drift. Uses constant-time comparison to avoid leaking timing.
 */
export function verifyTotp(secret: string, token: string): boolean {
  const normalized = (token || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(Date.now() / 1000 / PERIOD_SECONDS);
  for (let drift = -1; drift <= 1; drift += 1) {
    const candidate = hotp(secret, counter + drift);
    const a = Buffer.from(candidate);
    const b = Buffer.from(normalized);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

// ── AES-256-GCM encryption of the secret at rest ──
function encryptionKey(): Buffer {
  return scryptSync(getAuthSecret(), "ens-totp-secret-v1", 32);
}

export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string): string | null {
  const parts = payload.split(":");
  if (parts.length !== 5 || parts[0] !== "gcm" || parts[1] !== "v1") return null;
  try {
    const iv = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    const data = Buffer.from(parts[4], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ── Backup / recovery codes ──
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  const salt = randomBytes(12).toString("base64url");
  const derived = scryptSync(normalized, salt, 32).toString("base64url");
  return `scrypt:v1:${salt}:${derived}`;
}

export function verifyBackupCode(code: string, hash: string): boolean {
  const [algo, version, salt, derived] = hash.split(":");
  if (algo !== "scrypt" || version !== "v1" || !salt || !derived) return false;
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  const expected = Buffer.from(derived, "base64url");
  const actual = scryptSync(normalized, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ── Stateless login-challenge token (issued after password step, before TOTP) ──
interface ChallengePayload {
  sub: string;
  org: string;
  exp: number;
}

const CHALLENGE_TTL_SECONDS = 5 * 60;

export function issueChallengeToken(userId: string, organizationId: string): string {
  const payload: ChallengePayload = {
    sub: userId,
    org: organizationId,
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getAuthSecret()).update(`2fa.${body}`).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyChallengeToken(token: string): { userId: string; organizationId: string } | null {
  const [body, signature] = (token || "").split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", getAuthSecret()).update(`2fa.${body}`).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ChallengePayload;
    if (!payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { userId: payload.sub, organizationId: payload.org };
  } catch {
    return null;
  }
}
