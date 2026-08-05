import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const migrationsPath = resolve(root, "lib/db/migrations");
const journalPath = resolve(migrationsPath, "meta/_journal.json");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to verify database migrations.");
}

const sourceUrl = new URL(process.env.DATABASE_URL);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(sourceUrl.hostname) && process.env.ALLOW_DISPOSABLE_DATABASE_TEST !== "1") {
  throw new Error(
    "Refusing to create disposable databases on a non-local host. Set ALLOW_DISPOSABLE_DATABASE_TEST=1 only for an isolated CI database server.",
  );
}

const requireFromDb = createRequire(resolve(root, "lib/db/package.json"));
const { Pool } = requireFromDb("pg");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const orderedEntries = [...journal.entries].sort((a, b) => a.idx - b.idx);
const suffix = `${Date.now()}_${randomBytes(3).toString("hex")}`;
const cleanDatabase = `premium_saas_clean_${suffix}`;
const upgradeDatabase = `premium_saas_upgrade_${suffix}`;

function quoteIdentifier(value) {
  if (!/^premium_saas_(clean|upgrade)_[a-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe disposable database name: ${value}`);
  }
  return `"${value}"`;
}

function databaseUrl(databaseName) {
  const url = new URL(sourceUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function runMigrator(url) {
  const command = "pnpm --filter @workspace/db run migrate";
  const result = spawnSync(command, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    shell: true,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Migrator failed for disposable database with exit code ${result.status ?? "unknown"}.`);
  }
}

async function verifyFinalSchema(url) {
  const pool = new Pool({ connectionString: url });
  try {
    const result = await pool.query(`
      select
        (select count(*)::int from drizzle.__drizzle_migrations) as migration_count,
        to_regclass('public.clients_org_email_unique') is not null as client_email_unique,
        to_regclass('public.stripe_webhook_events') is not null as stripe_events,
        exists (
          select 1 from pg_constraint
          where conname = 'stripe_webhook_events_status_chk'
            and conrelid = 'public.stripe_webhook_events'::regclass
        ) as stripe_status_constraint,
        exists (
          select 1 from pg_constraint
          where conname = 'invitations_email_status_chk'
            and conrelid = 'public.invitations'::regclass
        ) as invitation_status_constraint,
        not exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'documents' and column_name = 'name'
        ) as documents_legacy_name_removed
    `);
    const row = result.rows[0];
    const expectedCount = orderedEntries.length;
    if (row.migration_count !== expectedCount) {
      throw new Error(`Expected ${expectedCount} migration journal rows, found ${row.migration_count}.`);
    }
    for (const field of [
      "client_email_unique",
      "stripe_events",
      "stripe_status_constraint",
      "invitation_status_constraint",
      "documents_legacy_name_removed",
    ]) {
      if (row[field] !== true) throw new Error(`Final schema assertion failed: ${field}.`);
    }
  } finally {
    await pool.end();
  }
}

async function seedHistoricalUpgrade(url) {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("create schema if not exists drizzle");
    await client.query(`
      create table drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `);

    for (const entry of orderedEntries.filter((item) => item.idx <= 11)) {
      const sql = readFileSync(resolve(migrationsPath, `${entry.tag}.sql`), "utf8");
      await client.query(sql);
      const hash = createHash("sha256").update(sql).digest("hex");
      await client.query(
        "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
        [hash, Number(entry.when)],
      );
    }

    // Reproduce an interrupted 0012 deployment: the table exists, but its
    // status constraint and migration-journal entry do not.
    await client.query(`
      create table stripe_webhook_events (
        event_id text primary key,
        event_type text not null,
        status text not null default 'processing',
        attempts integer not null default 1,
        last_error text,
        received_at timestamp with time zone not null default now(),
        processed_at timestamp with time zone,
        updated_at timestamp with time zone not null default now()
      )
    `);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const administrationPool = new Pool({ connectionString: sourceUrl.toString() });
const createdDatabases = [];

try {
  for (const name of [cleanDatabase, upgradeDatabase]) {
    await administrationPool.query(`create database ${quoteIdentifier(name)}`);
    createdDatabases.push(name);
  }

  const cleanUrl = databaseUrl(cleanDatabase);
  runMigrator(cleanUrl);
  await verifyFinalSchema(cleanUrl);
  console.log("Clean-database migration verification passed.");

  const upgradeUrl = databaseUrl(upgradeDatabase);
  await seedHistoricalUpgrade(upgradeUrl);
  runMigrator(upgradeUrl);
  await verifyFinalSchema(upgradeUrl);
  console.log("Interrupted historical-upgrade migration verification passed.");
} finally {
  for (const name of createdDatabases.reverse()) {
    await administrationPool.query(`drop database if exists ${quoteIdentifier(name)} with (force)`).catch((error) => {
      console.error(`Failed to remove disposable database ${name}:`, error.message);
      process.exitCode = 1;
    });
  }
  await administrationPool.end();
}
