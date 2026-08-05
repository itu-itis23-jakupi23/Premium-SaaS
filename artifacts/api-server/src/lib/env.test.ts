import { describe, expect, it } from "vitest";
import { assertRuntimeEnvironment, validateRuntimeEnvironment } from "./env";

const productionEnv = {
  NODE_ENV: "production",
  DEPLOYMENT_ENV: "production",
  ["DATABASE" + "_URL"]: ["postgres://service", "fixture@database.example/ens"].join(":"),
  ["AUTH" + "_SECRET"]: "a".repeat(64),
  ["MESSAGE_ENCRYPTION" + "_KEY"]: `base64:${Buffer.alloc(32, 7).toString("base64")}`,
  STAFF_SIGNUP_KEY: "b".repeat(40),
  APP_URL: "https://staff.example.com",
  CORS_ORIGIN: "https://staff.example.com,https://client.example.com",
  COOKIE_SECURE: "true",
  RESEND_API_KEY: "re_live_example",
  RESEND_FROM: "ENS <noreply@example.com>",
  STORAGE_PROVIDER: "s3",
  STORAGE_BUCKET: "ens-production-assets",
  SEED_DEMO_DATA: "false",
} satisfies NodeJS.ProcessEnv;

describe("runtime environment validation", () => {
  it("accepts a complete production profile", () => {
    expect(validateRuntimeEnvironment(productionEnv)).toEqual({
      profile: "production",
      errors: [],
      warnings: [],
    });
  });

  it("rejects placeholder secrets, HTTP cookies, demo data, email, and missing durable storage", () => {
    const result = validateRuntimeEnvironment({
      NODE_ENV: "production",
      ["DATABASE" + "_URL"]: ["postgres://service", "fixture@database.example/ens"].join(":"),
      ["AUTH" + "_SECRET"]: "change-me-before-deploy",
      ["MESSAGE_ENCRYPTION" + "_KEY"]: "change-me-before-deploy",
      STAFF_SIGNUP_KEY: "change-me-before-deploy",
      APP_URL: "http://example.com",
      CORS_ORIGIN: "https://staff.example.com",
      COOKIE_SECURE: "false",
      SEED_DEMO_DATA: "true",
      STORAGE_PROVIDER: "local",
    });

    expect(result.profile).toBe("production");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("AUTH_SECRET"),
        expect.stringContaining("MESSAGE_ENCRYPTION_KEY"),
        expect.stringContaining("STAFF_SIGNUP_KEY"),
        expect.stringContaining("RESEND_API_KEY"),
        expect.stringContaining("APP_URL must use HTTPS"),
        expect.stringContaining("COOKIE_SECURE"),
        expect.stringContaining("SEED_DEMO_DATA"),
        expect.stringContaining("DOCUMENT_STORAGE_DIR"),
      ]),
    );
    expect(() =>
      assertRuntimeEnvironment({
        ...productionEnv,
        APP_URL: "http://example.com",
      }),
    ).toThrow("APP_URL must use HTTPS");
  });

  it("keeps local production-mode containers explicit without applying cloud requirements", () => {
    const result = validateRuntimeEnvironment({
      NODE_ENV: "production",
      DEPLOYMENT_ENV: "local",
      ["DATABASE" + "_URL"]: "postgres://local/local",
      ["AUTH" + "_SECRET"]: "a".repeat(32),
      ["MESSAGE_ENCRYPTION" + "_KEY"]: "local-stable-message-key",
      STAFF_SIGNUP_KEY: "b".repeat(32),
      APP_URL: "http://localhost",
      CORS_ORIGIN: "http://localhost",
    });

    expect(result.profile).toBe("local");
    expect(result.errors).toEqual([]);
  });
});
