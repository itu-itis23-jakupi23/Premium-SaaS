const PLACEHOLDER_VALUES = new Set([
  "",
  "change-me-before-deploy",
  "ens-staff-local-dev",
  "replace-with-a-long-random-secret",
  "replace-with-a-separate-long-random-secret",
  "your-resend-api-key-here",
  "your-stripe-secret-key-here",
  "your-stripe-webhook-secret-here",
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
  // STORAGE_PROVIDER is the name the production backend validates in
  // api-server/src/lib/env.ts and reads in lib/storage.ts. This used to read
  // ASSET_STORAGE_PROVIDER, which nothing ever sets, so the readiness panel
  // reported storage as unconfigured no matter how the deployment was set up.
  return (process.env.STORAGE_PROVIDER || "local").trim().toLowerCase();
}

export function configReadiness() {
  const isProd = process.env.NODE_ENV === "production";
  const staffCode = process.env.STAFF_SIGNUP_KEY || process.env.CHIEF_BOOTSTRAP_KEY || process.env.STAFF_ACCESS_CODE || "";
  const assetStorage = assetStorageProvider();
  const assetStorageReady = assetStorage === "filesystem" && hasValue(process.env.WORKSPACE_ASSET_DIR);
  const stripeConfigured = hasValue(process.env.STRIPE_SECRET_KEY);
  const cookieSecure = process.env.COOKIE_SECURE?.trim().toLowerCase();
  const checks = {
    databaseConfigured: hasValue(process.env.DATABASE_URL),
    emailConfigured: hasValue(process.env.RESEND_API_KEY) && hasValue(process.env.RESEND_FROM),
    appUrlConfigured: isAbsoluteUrl(process.env.APP_URL),
    staffAccessConfigured: hasValue(staffCode),
    authSecretConfigured: hasValue(process.env.AUTH_SECRET),
    messageEncryptionConfigured: hasValue(process.env.MESSAGE_ENCRYPTION_KEY),
    cookieSecureCompatible: !isProd || cookieSecure === "false" || process.env.APP_URL?.startsWith("https://") === true,
    documentStorageConfigured: !isProd || hasValue(process.env.DOCUMENT_STORAGE_DIR),
    messageAttachmentStorageConfigured: !isProd || hasValue(process.env.MESSAGE_ATTACHMENT_DIR),
    stripeWebhookConfigured: !stripeConfigured || hasValue(process.env.STRIPE_WEBHOOK_SECRET),
    assetStorageConfigured: !isProd || assetStorageReady,
    productionMode: isProd,
  };
  const warnings = [
    !checks.databaseConfigured ? "DATABASE_URL is not configured." : null,
    !checks.emailConfigured ? "Resend email is not configured." : null,
    !checks.appUrlConfigured ? "APP_URL is not configured." : null,
    !checks.staffAccessConfigured ? "Staff access code is missing or still a placeholder." : null,
    !checks.authSecretConfigured ? "AUTH_SECRET is missing or still a placeholder." : null,
    !checks.messageEncryptionConfigured ? "MESSAGE_ENCRYPTION_KEY is missing or still a placeholder." : null,
    !checks.cookieSecureCompatible ? "COOKIE_SECURE is incompatible with the configured APP_URL. Use COOKIE_SECURE=false for HTTP or deploy behind HTTPS." : null,
    !checks.documentStorageConfigured ? "DOCUMENT_STORAGE_DIR must point at durable storage in production." : null,
    !checks.messageAttachmentStorageConfigured ? "MESSAGE_ATTACHMENT_DIR must point at durable storage in production." : null,
    !checks.stripeWebhookConfigured ? "STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is configured." : null,
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
      documentStorageDirConfigured: hasValue(process.env.DOCUMENT_STORAGE_DIR),
      messageAttachmentDirConfigured: hasValue(process.env.MESSAGE_ATTACHMENT_DIR),
    },
    billing: {
      stripeConfigured,
      stripeWebhookConfigured: checks.stripeWebhookConfigured,
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
    !readiness.checks.messageEncryptionConfigured ? "A non-placeholder MESSAGE_ENCRYPTION_KEY is required in production." : null,
    !readiness.checks.cookieSecureCompatible ? "COOKIE_SECURE must match APP_URL/proxy scheme in production." : null,
    !readiness.checks.documentStorageConfigured ? "Durable document storage is required in production." : null,
    !readiness.checks.messageAttachmentStorageConfigured ? "Durable message attachment storage is required in production." : null,
    !readiness.checks.stripeWebhookConfigured ? "STRIPE_WEBHOOK_SECRET is required when Stripe billing is configured." : null,
    !readiness.checks.assetStorageConfigured ? "Durable workspace asset storage is required in production." : null,
  ].filter(Boolean);
}

export function resendConfigured() {
  return hasValue(process.env.RESEND_API_KEY) && hasValue(process.env.RESEND_FROM);
}
