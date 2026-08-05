import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landingDirectory = resolve(root, "artifacts/ens-landing");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the isolated Playwright release suite.",
  );
}

const sourceUrl = new URL(process.env.DATABASE_URL);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (
  !localHosts.has(sourceUrl.hostname) &&
  process.env.ALLOW_DISPOSABLE_DATABASE_TEST !== "1"
) {
  throw new Error(
    "Refusing to create an E2E database on a non-local host. Set ALLOW_DISPOSABLE_DATABASE_TEST=1 only on an isolated CI server.",
  );
}

const suffix = `${Date.now()}_${randomBytes(3).toString("hex")}`;
const databaseName = `premium_saas_e2e_${suffix}`;
const testRunId = `release-${Date.now()}-${randomBytes(3).toString("hex")}`;
const playwrightTargets = process.argv.slice(2);
const apiPort = process.env.PLAYWRIGHT_RELEASE_API_PORT ?? "5100";
const staffPort = process.env.PLAYWRIGHT_RELEASE_STAFF_PORT ?? "5180";
const clientPort = process.env.PLAYWRIGHT_RELEASE_CLIENT_PORT ?? "5181";
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const staffOrigin = `http://127.0.0.1:${staffPort}`;
const clientOrigin = `http://127.0.0.1:${clientPort}`;
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = `/${databaseName}`;

function quoteDatabase(value) {
  if (!/^premium_saas_e2e_[a-z0-9_]+$/.test(value))
    throw new Error(`Unsafe E2E database name: ${value}`);
  return `"${value}"`;
}

function run(command, args, options = {}) {
  const label = [command, ...args].join(" ");
  console.log(`\n> ${label}`);
  const invocation = resolveInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    shell: false,
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error(
      `${label} failed with exit code ${result.status ?? "unknown"}.`,
    );
}

function start(command, args, options = {}) {
  const invocation = resolveInvocation(command, args);
  return spawn(invocation.command, invocation.args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    shell: options.shell ?? false,
    stdio: "inherit",
  });
}

function resolveInvocation(command, args) {
  if (command !== "pnpm") return { command, args };

  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) {
    throw new Error(
      "Unable to locate pnpm. Run this verifier through `pnpm run e2e:release`.",
    );
  }
  return { command: process.execPath, args: [pnpmCli, ...args] };
}

async function waitFor(url, child, label) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `${label} exited before readiness with code ${child.exitCode}.`,
      );
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`${label} did not become ready at ${url}.`);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => child.once("exit", resolveExit)),
      new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

const requireFromDb = createRequire(resolve(root, "lib/db/package.json"));
const { Pool } = requireFromDb("pg");
const administrationPool = new Pool({ connectionString: sourceUrl.toString() });
let apiProcess;
let staffProcess;
let clientProcess;

const serviceEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  NODE_ENV: "test",
  PORT: apiPort,
  AUTH_SECRET: randomBytes(32).toString("hex"),
  MESSAGE_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  STAFF_SIGNUP_KEY: "playwright-release-staff-key",
  APP_URL: staffOrigin,
  CORS_ORIGIN: `${staffOrigin},${clientOrigin}`,
  VITE_API_BASE_URL: `${apiOrigin}/api`,
  VITE_ORGANIZATION_SLUG: `ens-e2e-${testRunId}`,
  VITE_USE_MOCK_API: "false",
  VITE_USE_REAL_CORE: "true",
  VITE_USE_REAL_MESSAGES: "true",
};
const portalBuildEnv = {
  ...serviceEnv,
  NODE_ENV: "production",
};

try {
  await administrationPool.query(
    `create database ${quoteDatabase(databaseName)}`,
  );
  console.log(`Created disposable E2E database ${databaseName}.`);

  run("pnpm", ["--filter", "@workspace/db", "run", "migrate"], {
    env: serviceEnv,
  });
  if (process.env.PLAYWRIGHT_RELEASE_SKIP_BUILD !== "1") {
    run("pnpm", ["--filter", "@workspace/api-server", "run", "build"], {
      env: serviceEnv,
    });
    run("pnpm", ["--filter", "@workspace/ens-landing", "run", "build:staff"], {
      env: portalBuildEnv,
    });
    run("pnpm", ["--filter", "@workspace/ens-landing", "run", "build:client"], {
      env: portalBuildEnv,
    });
  }

  apiProcess = start(
    process.execPath,
    ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"],
    {
      env: serviceEnv,
      shell: false,
    },
  );
  await waitFor(`${apiOrigin}/api/healthz/ready`, apiProcess, "Production API");

  staffProcess = start(
    "pnpm",
    [
      "exec",
      "vite",
      "preview",
      "--config",
      "vite.config.ts",
      "--mode",
      "staff",
      "--host",
      "127.0.0.1",
      "--port",
      staffPort,
    ],
    {
      cwd: landingDirectory,
      env: { ...portalBuildEnv, PORT: staffPort },
    },
  );
  clientProcess = start(
    "pnpm",
    [
      "exec",
      "vite",
      "preview",
      "--config",
      "vite.config.ts",
      "--mode",
      "client",
      "--host",
      "127.0.0.1",
      "--port",
      clientPort,
    ],
    {
      cwd: landingDirectory,
      env: { ...portalBuildEnv, PORT: clientPort },
    },
  );
  await Promise.all([
    waitFor(staffOrigin, staffProcess, "Staff portal"),
    waitFor(clientOrigin, clientProcess, "Client portal"),
  ]);

  run("pnpm", ["exec", "playwright", "test", ...playwrightTargets], {
    cwd: landingDirectory,
    env: {
      ...serviceEnv,
      PLAYWRIGHT_BASE_URL: staffOrigin,
      PLAYWRIGHT_CLIENT_BASE_URL: clientOrigin,
      API_URL: apiOrigin,
      TEST_RUN_ID: testRunId,
      PLAYWRIGHT_TEST_TIMEOUT: process.env.PLAYWRIGHT_TEST_TIMEOUT ?? "60000",
    },
  });
  console.log("\nIsolated Playwright release suite passed.");
} finally {
  await stop(clientProcess);
  await stop(staffProcess);
  await stop(apiProcess);
  await administrationPool
    .query(
      `drop database if exists ${quoteDatabase(databaseName)} with (force)`,
    )
    .catch((error) => {
      console.error(
        `Failed to remove disposable E2E database ${databaseName}:`,
        error.message,
      );
      process.exitCode = 1;
    });
  await administrationPool.end();
}
