import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  issueChallengeToken,
  totpAuthUri,
  verifyBackupCode,
  verifyChallengeToken,
  verifyTotp,
} from "./totp";

// RFC 6238 Appendix B test vector: ASCII secret "12345678901234567890" in base32,
// SHA-1, 30s period. At T=59s the 8-digit code is 94287082 → 6-digit is 287082.
const RFC_SECRET_BASE32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

afterEach(() => {
  vi.useRealTimers();
});

describe("verifyTotp", () => {
  it("accepts the RFC 6238 reference code at the reference time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59_000));
    expect(verifyTotp(RFC_SECRET_BASE32, "287082")).toBe(true);
  });

  it("rejects an incorrect code at the reference time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59_000));
    expect(verifyTotp(RFC_SECRET_BASE32, "000000")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(verifyTotp(RFC_SECRET_BASE32, "12345")).toBe(false); // too short
    expect(verifyTotp(RFC_SECRET_BASE32, "abcdef")).toBe(false); // non-numeric
    expect(verifyTotp(RFC_SECRET_BASE32, "")).toBe(false);
  });

  it("tolerates a code from the previous 30s window (clock drift)", () => {
    // At T=89s the current counter is 2; the RFC code 287082 belongs to counter 1
    // and must still verify because of the ±1 window.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(89_000));
    expect(verifyTotp(RFC_SECRET_BASE32, "287082")).toBe(true);
  });

  it("generates distinct base32 secrets", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]+$/);
    expect(a).not.toBe(b);
  });
});

describe("totpAuthUri", () => {
  it("builds a scannable otpauth URI", () => {
    const uri = totpAuthUri("JBSWY3DPEHPK3PXP", "user@example.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=ENS");
  });
});

describe("secret encryption", () => {
  it("round-trips a secret through AES-GCM", () => {
    const secret = generateTotpSecret();
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("returns null for tampered or malformed ciphertext", () => {
    const encrypted = encryptSecret("JBSWY3DPEHPK3PXP");
    const tampered = encrypted.slice(0, -4) + "AAAA";
    expect(decryptSecret(tampered)).toBeNull();
    expect(decryptSecret("not-a-valid-payload")).toBeNull();
  });
});

describe("backup codes", () => {
  it("generates the requested number of formatted codes", () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    for (const code of codes) expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
  });

  it("verifies a hashed code and rejects a wrong one", () => {
    const [code] = generateBackupCodes(1);
    const hash = hashBackupCode(code);
    expect(hash).not.toContain(code.replace("-", ""));
    expect(verifyBackupCode(code, hash)).toBe(true);
    expect(verifyBackupCode("00000-00000", hash)).toBe(false);
  });

  it("normalizes case, dashes, and spaces when verifying", () => {
    const hash = hashBackupCode("ABCDE-12345");
    expect(verifyBackupCode("abcde12345", hash)).toBe(true);
    expect(verifyBackupCode("ABCDE 12345", hash)).toBe(true);
  });
});

describe("challenge token", () => {
  it("round-trips user and organization ids", () => {
    const token = issueChallengeToken("user-1", "org-1");
    expect(verifyChallengeToken(token)).toEqual({ userId: "user-1", organizationId: "org-1" });
  });

  it("rejects a tampered signature", () => {
    const token = issueChallengeToken("user-1", "org-1");
    const [body] = token.split(".");
    expect(verifyChallengeToken(`${body}.deadbeef`)).toBeNull();
    expect(verifyChallengeToken("garbage")).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = issueChallengeToken("user-1", "org-1");
    // Advance past the 5-minute TTL.
    vi.setSystemTime(new Date("2026-01-01T00:06:00Z"));
    expect(verifyChallengeToken(token)).toBeNull();
  });
});
