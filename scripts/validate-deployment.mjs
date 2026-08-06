import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const checks = [];

verify("API Dockerfile", "artifacts/api-server/Dockerfile", [
  [/corepack prepare pnpm@10\.24\.0 --activate/, "pin pnpm 10.24.0"],
  [
    /http:\/\/localhost:5000\/api\/healthz\/ready/,
    "probe the real API readiness route",
  ],
]);

verify("frontend Dockerfile", "artifacts/ens-landing/Dockerfile", [
  [/corepack prepare pnpm@10\.24\.0 --activate/, "pin pnpm 10.24.0"],
]);

verify("Nginx proxy", "artifacts/ens-landing/nginx.conf", [
  [/client_max_body_size\s+80m;/, "accept the configured API payload ceiling"],
  [
    /location \/api\/\s*\{[\s\S]*?proxy_pass http:\/\/api:5000;/,
    "preserve the /api prefix",
  ],
  [
    /proxy_set_header X-Forwarded-Proto \$scheme;/,
    "forward the public protocol",
  ],
  [
    /add_header X-Content-Type-Options "nosniff" always;/,
    "set basic response hardening headers",
  ],
]);

verify("base Compose stack", "docker-compose.yml", [
  [/ens_postgres_data:\/var\/lib\/postgresql\/data/, "persist PostgreSQL data"],
  [/ens_api_data:\/app\/data/, "persist local API uploads"],
  [
    /http:\/\/localhost:5000\/api\/healthz\/ready/,
    "use the API readiness route",
  ],
  [
    /POSTGRES_PASSWORD:\s*"\$\{POSTGRES_PASSWORD:\?/,
    "require the database password",
  ],
]);

verify("production Compose override", "docker-compose.prod.yml", [
  [/DEPLOYMENT_ENV:\s*production/, "enable strict production validation"],
  [/APP_URL:\s*"\$\{APP_URL:\?/, "require the public application URL"],
  [/CORS_ORIGIN:\s*"\$\{CORS_ORIGIN:\?/, "require explicit allowed origins"],
  [/COOKIE_SECURE:\s*"true"/, "force secure cookies"],
  [
    /RESEND_API_KEY:\s*"\$\{RESEND_API_KEY:\?/,
    "require transactional email configuration",
  ],
  [
    /STORAGE_PROVIDER:\s*"\$\{STORAGE_PROVIDER:\?/,
    "require an explicit storage provider",
  ],
]);

verify("API proxy trust", "artifacts/api-server/src/app.ts", [
  [
    /app\.set\("trust proxy", trustProxySetting\(\)\)/,
    "configure the deployment proxy boundary",
  ],
]);

verify("environment template", ".env.example", [
  [/^DATABASE_URL=/m, "document DATABASE_URL"],
  [/^AUTH_SECRET=/m, "document AUTH_SECRET"],
  [/^MESSAGE_ENCRYPTION_KEY=/m, "document MESSAGE_ENCRYPTION_KEY"],
  [/^TRUST_PROXY=/m, "document TRUST_PROXY"],
  [/^STORAGE_PROVIDER=/m, "document STORAGE_PROVIDER"],
  [/^RESEND_API_KEY=/m, "document RESEND_API_KEY"],
]);

reject("API Dockerfile", "artifacts/api-server/Dockerfile", [
  [/@latest/, "must not install an unpinned package manager"],
  [
    /http:\/\/localhost:5000\/healthz(?:\s|$)/,
    "must not probe the unmounted health route",
  ],
]);

reject("Nginx proxy", "artifacts/ens-landing/nginx.conf", [
  [/proxy_pass http:\/\/api:5000\/;/, "must not strip the /api prefix"],
  [
    /location \/workspace-assets\//,
    "must not proxy the removed development-only asset route",
  ],
]);

if (failures.length > 0) {
  console.error("Deployment preflight failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Deployment preflight passed (${checks.length} wiring checks).`);

function verify(label, relativePath, requirements) {
  let contents;
  try {
    contents = readFileSync(resolve(root, relativePath), "utf8");
  } catch (error) {
    failures.push(`${label}: cannot read ${relativePath} (${error.message})`);
    return;
  }

  for (const [pattern, expectation] of requirements) {
    if (!pattern.test(contents)) {
      failures.push(`${label}: must ${expectation} (${relativePath})`);
    } else {
      checks.push(`${label}: ${expectation}`);
    }
  }
}

function reject(label, relativePath, forbiddenPatterns) {
  let contents;
  try {
    contents = readFileSync(resolve(root, relativePath), "utf8");
  } catch (error) {
    failures.push(`${label}: cannot read ${relativePath} (${error.message})`);
    return;
  }

  for (const [pattern, expectation] of forbiddenPatterns) {
    if (pattern.test(contents)) {
      failures.push(`${label}: ${expectation} (${relativePath})`);
    } else {
      checks.push(`${label}: ${expectation}`);
    }
  }
}
