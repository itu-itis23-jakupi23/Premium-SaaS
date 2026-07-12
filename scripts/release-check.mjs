import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

const checks = [
  ["pnpm", ["run", "typecheck", "--pretty", "false"]],
  ["pnpm", ["--filter", "@workspace/api-server", "run", "test"]],
  ["pnpm", ["--filter", "@workspace/api-server", "run", "build"]],
  ["pnpm", ["--filter", "@workspace/ens-landing", "run", "smoke:workflow"]],
  ["pnpm", ["--filter", "@workspace/ens-landing", "run", "build:staff"]],
  ["pnpm", ["--filter", "@workspace/ens-landing", "run", "build:client"]],
];

if (process.env.RELEASE_CHECK_SKIP_MIGRATE !== "1") {
  checks.splice(1, 0, ["pnpm", ["--filter", "@workspace/db", "run", "migrate"]]);
} else {
  console.warn("\nSkipping db:migrate because RELEASE_CHECK_SKIP_MIGRATE=1. Use only after manually proving this database is already migrated.");
}

for (const [command, args] of checks) {
  const label = [command, ...args].join(" ");
  console.log(`\n> ${label}`);
  const result = process.platform === "win32"
    ? spawnSync(label, { cwd: root, env: process.env, shell: true, stdio: "inherit" })
    : spawnSync(command, args, { cwd: root, env: process.env, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\nrelease:check failed at: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nrelease:check passed");
