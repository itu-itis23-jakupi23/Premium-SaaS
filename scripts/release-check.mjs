import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const evidenceDirectory = resolve(root, ".release-evidence");
const evidencePath = resolve(evidenceDirectory, "release-check.json");
const commitResult = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
});
const evidence = {
  schemaVersion: 1,
  commit: process.env.GITHUB_SHA ?? commitResult.stdout?.trim() ?? "unknown",
  startedAt: new Date().toISOString(),
  completedAt: null,
  status: "running",
  failedStep: null,
  checks: [],
};

function writeEvidence(status, failedStep = null) {
  evidence.status = status;
  evidence.failedStep = failedStep;
  evidence.completedAt = new Date().toISOString();
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

if (existsSync(envPath)) {
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
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

const checks = [
  ["pnpm", ["run", "lint"]],
  ["pnpm", ["run", "typecheck", "--pretty", "false"]],
  ["pnpm", ["run", "deployment:preflight"]],
  ["pnpm", ["run", "security:audit"]],
  ["pnpm", ["run", "security:secrets"]],
  ["pnpm", ["run", "db:check-journal"]],
  ["pnpm", ["run", "db:verify-migrations"]],
  ["pnpm", ["run", "db:verify-backup"]],
  ["pnpm", ["--filter", "@workspace/api-zod", "run", "test"]],
  ["pnpm", ["--filter", "@workspace/api-server", "run", "test"]],
  ["pnpm", ["--filter", "@workspace/api-server", "run", "build"]],
  ["pnpm", ["run", "storage:verify-restart"]],
];

const postSmokeChecks = [
  ["pnpm", ["--filter", "@workspace/ens-landing", "run", "build:staff"]],
  ["pnpm", ["--filter", "@workspace/ens-landing", "run", "build:client"]],
  ["pnpm", ["run", "performance:budgets"]],
];

if (process.env.RELEASE_CHECK_SKIP_MIGRATE !== "1") {
  checks.splice(1, 0, [
    "pnpm",
    ["--filter", "@workspace/db", "run", "migrate"],
  ]);
} else {
  console.warn(
    "\nSkipping db:migrate because RELEASE_CHECK_SKIP_MIGRATE=1. Use only after manually proving this database is already migrated.",
  );
}

function runCheck(command, args, env = process.env) {
  const label = [command, ...args].join(" ");
  const startedAt = Date.now();
  console.log(`\n> ${label}`);
  const result =
    process.platform === "win32"
      ? spawnSync(label, { cwd: root, env, shell: true, stdio: "inherit" })
      : spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  evidence.checks.push({
    label,
    status: result.status === 0 ? "passed" : "failed",
    durationMs: Date.now() - startedAt,
  });
  if (result.status !== 0) {
    writeEvidence("failed", label);
    console.error(`\nrelease:check failed at: ${label}`);
    console.error(`Release evidence: ${evidencePath}`);
    process.exit(result.status ?? 1);
  }
}

async function waitForReadiness(url, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Production API exited before readiness with code ${child.exitCode}.`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server may still be binding or establishing its database pool.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(
    `Production API did not become ready at ${url} within 30 seconds.`,
  );
}

for (const [command, args] of checks) {
  runCheck(command, args);
}

const apiPort = process.env.RELEASE_CHECK_API_PORT ?? "5099";
const apiBaseUrl = `http://127.0.0.1:${apiPort}/api`;
const apiProcess = spawn(
  process.execPath,
  ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: "test", PORT: apiPort },
    stdio: "inherit",
  },
);

try {
  await waitForReadiness(`${apiBaseUrl}/healthz/ready`, apiProcess);
  runCheck(
    "pnpm",
    ["--filter", "@workspace/ens-landing", "run", "smoke:workflow"],
    {
      ...process.env,
      API_BASE_URL: apiBaseUrl,
    },
  );
} finally {
  apiProcess.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => apiProcess.once("exit", resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  if (apiProcess.exitCode === null) apiProcess.kill("SIGKILL");
}

for (const [command, args] of postSmokeChecks) {
  runCheck(command, args, {
    ...process.env,
    NODE_ENV: "production",
  });
}

runCheck("pnpm", ["run", "e2e:release"]);

writeEvidence("passed");
console.log("\nrelease:check passed");
console.log(`Release evidence: ${evidencePath}`);
