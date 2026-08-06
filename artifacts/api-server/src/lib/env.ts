import { isIP } from "node:net";

export type DeploymentProfile =
  | "development"
  | "test"
  | "local"
  | "staging"
  | "production";

export interface EnvironmentValidation {
  profile: DeploymentProfile;
  errors: string[];
  warnings: string[];
}

const PLACEHOLDERS = new Set([
  "change-me",
  "change-me-before-deploy",
  "change-this-password",
  "replace-me",
  "your-resend-api-key-here",
  "your-stripe-secret-key-here",
  "your-stripe-webhook-secret-here",
]);

export function validateRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentValidation {
  const profile = deploymentProfile(env);
  const errors: string[] = [];
  const warnings: string[] = [];
  const strict = profile === "production";
  const report = (message: string) =>
    (strict ? errors : warnings).push(message);

  requireConfigured(env, "DATABASE_URL", report);
  requireConfigured(env, "AUTH_SECRET", report);
  requireConfigured(env, "MESSAGE_ENCRYPTION_KEY", report);
  requireConfigured(env, "STAFF_SIGNUP_KEY", report);
  requireConfigured(env, "APP_URL", report);
  requireConfigured(env, "CORS_ORIGIN", report);

  if (strict) {
    requireConfigured(env, "RESEND_API_KEY", report);
    requireConfigured(env, "RESEND_FROM", report);

    if (env.SEED_DEMO_DATA?.toLowerCase() === "true") {
      errors.push("SEED_DEMO_DATA must be false in production.");
    }

    if (!isHttpsUrl(env.APP_URL)) {
      errors.push("APP_URL must use HTTPS in production.");
    }

    if (env.COOKIE_SECURE?.trim().toLowerCase() !== "true") {
      errors.push("COOKIE_SECURE must be true in production.");
    }

    validateTrustProxy(env, errors);
    validateCorsOrigins(env, errors);
    validateStorage(env, errors);
  }

  validateSecretLength(env.AUTH_SECRET, "AUTH_SECRET", 32, report);
  validateMessageKey(env.MESSAGE_ENCRYPTION_KEY, report);
  validateApiJsonLimit(env.API_JSON_LIMIT, report);
  validateStripe(env, report);

  return { profile, errors, warnings };
}

export function assertRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const result = validateRuntimeEnvironment(env);
  if (result.errors.length > 0) {
    throw new Error(
      `Invalid ${result.profile} environment:\n- ${result.errors.join("\n- ")}`,
    );
  }
  return result;
}

function deploymentProfile(env: NodeJS.ProcessEnv): DeploymentProfile {
  const requested = env.DEPLOYMENT_ENV?.trim().toLowerCase();
  if (
    requested === "development" ||
    requested === "test" ||
    requested === "local" ||
    requested === "staging" ||
    requested === "production"
  ) {
    return requested;
  }
  if (env.NODE_ENV === "production") return "production";
  if (env.NODE_ENV === "test" || env.VITEST) return "test";
  return "development";
}

function configured(value: string | undefined) {
  const normalized = value?.trim();
  return Boolean(normalized && !PLACEHOLDERS.has(normalized.toLowerCase()));
}

function requireConfigured(
  env: NodeJS.ProcessEnv,
  key: string,
  report: (message: string) => void,
) {
  if (!configured(env[key]))
    report(`${key} is required and cannot be a placeholder.`);
}

function validateSecretLength(
  value: string | undefined,
  key: string,
  minimum: number,
  report: (message: string) => void,
) {
  if (configured(value) && value!.length < minimum) {
    report(`${key} must contain at least ${minimum} characters.`);
  }
}

function validateMessageKey(
  value: string | undefined,
  report: (message: string) => void,
) {
  if (!configured(value) || !value?.startsWith("base64:")) return;
  const decoded = Buffer.from(value.slice("base64:".length), "base64");
  if (decoded.length !== 32) {
    report(
      "MESSAGE_ENCRYPTION_KEY base64 value must decode to exactly 32 bytes.",
    );
  }
}

function validateStorage(env: NodeJS.ProcessEnv, errors: string[]) {
  const provider = env.STORAGE_PROVIDER?.trim().toLowerCase() || "local";
  if (provider === "s3") {
    if (!configured(env.STORAGE_BUCKET)) {
      errors.push("STORAGE_BUCKET is required when STORAGE_PROVIDER=s3.");
    }
    return;
  }
  if (provider !== "local") {
    errors.push("STORAGE_PROVIDER must be either local or s3.");
    return;
  }

  for (const key of [
    "DOCUMENT_STORAGE_DIR",
    "MESSAGE_ATTACHMENT_DIR",
    "WORKSPACE_ASSET_DIR",
  ]) {
    if (!configured(env[key])) {
      errors.push(`${key} must point to durable storage in production.`);
    }
  }
}

function validateTrustProxy(env: NodeJS.ProcessEnv, errors: string[]) {
  const value = env.TRUST_PROXY?.trim().toLowerCase();
  if (!value) {
    errors.push("TRUST_PROXY is required in production.");
    return;
  }
  if (value === "true") {
    errors.push(
      "TRUST_PROXY cannot be true in production; use the exact proxy hop count or a trusted subnet.",
    );
    return;
  }
  const validName = ["loopback", "linklocal", "uniquelocal"].includes(value);
  const validHopCount = /^[1-9]\d*$/.test(value) && Number(value) <= 10;
  const validSubnetList = value.split(",").every(validTrustedAddress);
  if (!validName && !validHopCount && !validSubnetList) {
    errors.push(
      "TRUST_PROXY must be a proxy hop count, trusted subnet, loopback, linklocal, or uniquelocal.",
    );
  }
}

function validTrustedAddress(value: string) {
  const [address, prefix, extra] = value.trim().split("/");
  if (extra !== undefined) return false;
  const version = isIP(address);
  if (version === 0) return false;
  if (prefix === undefined) return true;
  if (!/^\d+$/.test(prefix)) return false;
  const bits = Number(prefix);
  return bits >= 0 && bits <= (version === 4 ? 32 : 128);
}

function validateCorsOrigins(env: NodeJS.ProcessEnv, errors: string[]) {
  const values =
    env.CORS_ORIGIN?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  if (values.length === 0) return;
  for (const value of values) {
    if (value === "*") {
      errors.push("CORS_ORIGIN cannot contain * when credentials are enabled.");
      continue;
    }
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.origin !== value.replace(/\/$/, "")
      ) {
        errors.push(
          `CORS_ORIGIN entry must be an HTTPS origin without a path: ${value}`,
        );
      }
    } catch {
      errors.push(`CORS_ORIGIN contains an invalid URL: ${value}`);
    }
  }
}

function validateApiJsonLimit(
  value: string | undefined,
  report: (message: string) => void,
) {
  if (!value) {
    report("API_JSON_LIMIT is required and must use kb or mb units.");
    return;
  }
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d+)(kb|mb)$/);
  if (!match) {
    report("API_JSON_LIMIT must be a positive integer followed by kb or mb.");
    return;
  }
  const amount = Number(match[1]);
  const bytes = amount * (match[2] === "mb" ? 1024 * 1024 : 1024);
  if (amount < 1 || bytes > 100 * 1024 * 1024) {
    report("API_JSON_LIMIT must be between 1kb and 100mb.");
  }
}

function validateStripe(
  env: NodeJS.ProcessEnv,
  report: (message: string) => void,
) {
  if (!configured(env.STRIPE_SECRET_KEY)) return;
  for (const key of [
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_STARTER",
    "STRIPE_PRICE_PRO",
    "STRIPE_PRICE_UNLIMITED",
  ]) {
    if (!configured(env[key]))
      report(`${key} is required when Stripe billing is enabled.`);
  }
}

function isHttpsUrl(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
