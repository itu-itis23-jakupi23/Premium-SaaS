import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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
    process.env[key] ??= value;
  }
}

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required for backup verification.");

const sourceUrl = new URL(process.env.DATABASE_URL);
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(sourceUrl.hostname);
if (!isLocal && process.env.ALLOW_DISPOSABLE_DATABASE_TEST !== "1") {
  throw new Error(
    "Refusing to create a restore database on a non-local host without ALLOW_DISPOSABLE_DATABASE_TEST=1.",
  );
}

const require = createRequire(import.meta.url);
const pgPath = require.resolve("pg", { paths: [resolve(root, "lib/db")] });
const { Client } = require(pgPath);
const restoreDatabase = `premium_saas_restore_${Date.now()}_${randomBytes(3).toString("hex")}`;
const restoreUrl = new URL(sourceUrl);
restoreUrl.pathname = `/${restoreDatabase}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
const backupPath = join(tmpdir(), `${restoreDatabase}.dump`);

function findPostgresTool(tool, override) {
  if (override) return override;
  const locator = process.platform === "win32" ? "where.exe" : "which";
  const located = spawnSync(locator, [tool], { encoding: "utf8" });
  const first =
    located.status === 0 ? located.stdout.split(/\r?\n/).find(Boolean) : null;
  if (first) return first.trim();

  if (process.platform === "win32") {
    const postgresRoot = "C:\\Program Files\\PostgreSQL";
    if (existsSync(postgresRoot)) {
      const versions = readdirSync(postgresRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => Number(right) - Number(left));
      for (const version of versions) {
        const candidate = join(postgresRoot, version, "bin", `${tool}.exe`);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  throw new Error(
    `${tool} was not found. Install the PostgreSQL client tools or set ${tool.toUpperCase()}_BIN.`,
  );
}

function runTool(command, args, databaseUrl) {
  const parsed = new URL(databaseUrl);
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(parsed.password),
  };
  const result = spawnSync(command, args, { cwd: root, env, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed: ${result.stderr || result.stdout || `exit ${result.status}`}`,
    );
  }
}

async function snapshot(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const tables = (
      await client.query(`
      select tablename
      from pg_catalog.pg_tables
      where schemaname = 'public'
      order by tablename
    `)
    ).rows.map((row) => row.tablename);
    const counts = {};
    for (const table of tables) {
      const quoted = `"${String(table).replaceAll('"', '""')}"`;
      counts[table] = Number(
        (await client.query(`select count(*)::int as count from ${quoted}`))
          .rows[0].count,
      );
    }
    return { tables, counts };
  } finally {
    await client.end();
  }
}

async function executeAdmin(statement) {
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

const pgDump = findPostgresTool("pg_dump", process.env.PG_DUMP_BIN);
const pgRestore = findPostgresTool("pg_restore", process.env.PG_RESTORE_BIN);
const quotedDatabase = `"${restoreDatabase.replaceAll('"', '""')}"`;
let restoreCreated = false;

try {
  const before = await snapshot(sourceUrl.toString());
  runTool(
    pgDump,
    [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      backupPath,
      sourceUrl.toString(),
    ],
    sourceUrl.toString(),
  );
  if (!existsSync(backupPath))
    throw new Error("pg_dump completed without creating a backup file.");

  await executeAdmin(`create database ${quotedDatabase}`);
  restoreCreated = true;
  runTool(
    pgRestore,
    [
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "--dbname",
      restoreUrl.toString(),
      backupPath,
    ],
    restoreUrl.toString(),
  );

  const after = await snapshot(restoreUrl.toString());
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new Error(
      `Restored database does not match source table counts.\nSource: ${JSON.stringify(before)}\nRestore: ${JSON.stringify(after)}`,
    );
  }
  console.log(
    `Backup and restore verification passed for ${before.tables.length} public tables.`,
  );
} finally {
  if (restoreCreated) {
    await executeAdmin(
      `drop database if exists ${quotedDatabase} with (force)`,
    );
  }
  rmSync(backupPath, { force: true });
}
