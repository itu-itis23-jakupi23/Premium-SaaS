const PLACEHOLDER_VALUES = new Set([
  "",
  "change-me-before-deploy",
  "ens-staff-local-dev",
  "replace-with-a-long-random-secret",
  "your-resend-api-key-here",
]);

function hasValue(value: string | undefined | null) {
  return Boolean(value && !PLACEHOLDER_VALUES.has(value.trim()));
}

function isAbsoluteUrl(value: string | undefined | null) {
  return Boolean(value && /^https?:\/\//.test(value));
}

export function apiJsonLimit() {
  return process.env.API_JSON_LIMIT || "75mb";
}

export function assetStorageProvider() {
  return (process.env.ASSET_STORAGE_PROVIDER || "local").trim().toLowerCase();
}

export function configReadiness() {
  const isProd = process.env.NODE_ENV === "production";
  const staffCode = process.env.STAFF_SIGNUP_KEY || process.env.CHIEF_BOOTSTRAP_KEY || process.env.STAFF_ACCESS_CODE || "";
  const assetStorage = assetStorageProvider();
  const assetStorageReady = assetStorage === "filesystem" && hasValue(process.env.WORKSPACE_ASSET_DIR);
  const checks = {
    databaseConfigured: hasValue(process.env.DATABASE_URL),
    emailConfigured: hasValue(process.env.RESEND_API_KEY) && hasValue(process.env.RESEND_FROM),
    appUrlConfigured: isAbsoluteUrl(process.env.APP_URL),
    staffAccessConfigured: hasValue(staffCode),
    authSecretConfigured: hasValue(process.env.AUTH_SECRET),
    assetStorageConfigured: !isProd || assetStorageReady,
    productionMode: isProd,
  };
  const warnings = [
    !checks.databaseConfigured ? "DATABASE_URL is not configured." : null,
    !checks.emailConfigured ? "Resend email is not configured." : null,
    !checks.appUrlConfigured ? "APP_URL is not configured." : null,
    !checks.staffAccessConfigured ? "Staff access code is missing or still a placeholder." : null,
    !checks.authSecretConfigured ? "AUTH_SECRET is missing or still a placeholder." : null,
    !checks.assetStorageConfigured ? "Workspace asset storage is not production-ready. Configure ASSET_STORAGE_PROVIDER=filesystem with WORKSPACE_ASSET_DIR mounted on durable storage." : null,
  ].filter(Boolean);
  return {
    ready: Object.values(checks).every(Boolean),
    mode: isProd ? "production" : "development",
    checks,
    limits: {
      apiJsonLimit: apiJsonLimit(),
    },
    storage: {
      assetStorageProvider: assetStorage,
      workspaceAssetDirConfigured: hasValue(process.env.WORKSPACE_ASSET_DIR),
    },
    warnings,
  };
}

export function productionConfigProblems() {
  const readiness = configReadiness();
  return [
    !readiness.checks.databaseConfigured ? "DATABASE_URL is required in production." : null,
    !readiness.checks.emailConfigured ? "RESEND_API_KEY and RESEND_FROM are required in production." : null,
    !readiness.checks.appUrlConfigured ? "APP_URL must be an absolute URL in production." : null,
    !readiness.checks.staffAccessConfigured ? "A non-placeholder server-side staff signup key is required in production." : null,
    !readiness.checks.authSecretConfigured ? "A non-placeholder AUTH_SECRET is required in production." : null,
    !readiness.checks.assetStorageConfigured ? "Durable workspace asset storage is required in production." : null,
  ].filter(Boolean);
}

export function resendConfigured() {
  return hasValue(process.env.RESEND_API_KEY) && hasValue(process.env.RESEND_FROM);
}
