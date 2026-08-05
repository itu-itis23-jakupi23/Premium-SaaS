import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDirectory = resolve(root, ".release-evidence");
const evidencePath = resolve(evidenceDirectory, "clean-room-release.json");
const env = { ...process.env };

loadEnv(resolve(root, ".env"), env);

const sourceStatus = capture("git", ["status", "--porcelain=v1"], root);
if (sourceStatus.trim()) {
  console.error(
    "Clean-room verification requires a clean working tree. Commit the intentional changes first.",
  );
  process.exit(1);
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "premium-saas-clean-room-"));
const checkout = join(temporaryRoot, "checkout");
const commit = capture("git", ["rev-parse", "HEAD"], root).trim();
const sourceUrl = requiredDatabaseUrl(env);
const databaseName = `premium_saas_release_${Date.now()}_${randomBytes(3).toString("hex")}`;
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = `/${databaseName}`;
const requireFromDb = createRequire(resolve(root, "lib/db/package.json"));
const { Pool } = requireFromDb("pg");
const administrationPool = new Pool({ connectionString: sourceUrl.toString() });
const evidence = {
  schemaVersion: 1,
  commit,
  startedAt: new Date().toISOString(),
  completedAt: null,
  status: "running",
  sourceClean: true,
  dependencyInstall: "pending",
  releaseGate: "pending",
  checkoutCleanAfterGate: null,
  releaseEvidence: null,
};

try {
  run("git", ["clone", "--no-hardlinks", "--quiet", root, checkout], root);
  run("git", ["checkout", "--detach", "--quiet", commit], checkout);

  run("pnpm", ["install", "--frozen-lockfile"], checkout, env);
  evidence.dependencyInstall = "passed";

  await administrationPool.query(
    `create database ${quoteDatabase(databaseName)}`,
  );
  const gateEnv = {
    ...env,
    DATABASE_URL: databaseUrl.toString(),
    ALLOW_DISPOSABLE_DATABASE_TEST: "1",
  };
  run("pnpm", ["run", "release:check"], checkout, gateEnv);
  evidence.releaseGate = "passed";

  const checkoutStatus = capture("git", ["status", "--porcelain=v1"], checkout);
  evidence.checkoutCleanAfterGate = checkoutStatus.trim() === "";
  if (!evidence.checkoutCleanAfterGate) {
    throw new Error(
      `Release gate dirtied the clean checkout:\n${checkoutStatus.trim()}`,
    );
  }

  const nestedEvidencePath = resolve(
    checkout,
    ".release-evidence/release-check.json",
  );
  evidence.releaseEvidence = JSON.parse(
    readFileSync(nestedEvidencePath, "utf8"),
  );
  if (
    evidence.releaseEvidence.status !== "passed" ||
    evidence.releaseEvidence.commit !== commit
  ) {
    throw new Error("Release evidence did not prove the exact clean commit.");
  }
  evidence.status = "passed";
  console.log(`\nClean-room release passed for commit ${commit}.`);
} catch (error) {
  evidence.status = "failed";
  evidence.error = error instanceof Error ? error.message : String(error);
  console.error(`\nClean-room release failed: ${evidence.error}`);
  process.exitCode = 1;
} finally {
  await administrationPool
    .query(
      `drop database if exists ${quoteDatabase(databaseName)} with (force)`,
    )
    .catch((error) => {
      evidence.status = "failed";
      evidence.error = `Failed to remove disposable database: ${error.message}`;
      process.exitCode = 1;
    });
  await administrationPool.end();
  evidence.completedAt = new Date().toISOString();
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (env.KEEP_CLEAN_ROOM !== "1") {
    rmSync(temporaryRoot, { recursive: true, force: true });
  } else {
    console.log(`Clean-room checkout retained at ${checkout}.`);
  }
  console.log(`Clean-room evidence: ${evidencePath}`);
}

function run(command, args, cwd, childEnv = process.env) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const executable =
    process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
  const result = spawnSync(executable, args, {
    cwd,
    env: childEnv,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
}

function capture(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${command} failed.`);
  }
  return result.stdout;
}

function loadEnv(path, target) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    target[key] ??= value;
  }
}

function requiredDatabaseUrl(environment) {
  if (!environment.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for clean-room verification.");
  }
  const url = new URL(environment.DATABASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (
    !localHosts.has(url.hostname) &&
    environment.ALLOW_DISPOSABLE_DATABASE_TEST !== "1"
  ) {
    throw new Error(
      "Refusing clean-room database creation on a non-local host without ALLOW_DISPOSABLE_DATABASE_TEST=1.",
    );
  }
  return url;
}

function quoteDatabase(value) {
  if (!/^premium_saas_release_[a-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe disposable database name: ${value}`);
  }
  return `"${value}"`;
}
