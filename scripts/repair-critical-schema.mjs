import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

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
  console.error("DATABASE_URL is required. Set it in .env or in the shell before running this command.");
  process.exit(1);
}

const requireFromDb = createRequire(resolve(root, "lib/db/package.json"));
const pg = requireFromDb("pg");
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`
    create table if not exists login_rate_limits (
      key text primary key,
      attempts integer not null default 1,
      window_start timestamptz not null default now()
    )
  `);
    await client.query(`
    create index if not exists login_rate_limits_window_idx
      on login_rate_limits using btree (window_start)
  `);
    await client.query(`
    create table if not exists stripe_webhook_events (
      event_id text primary key,
      event_type text not null,
      status text not null default 'processing',
      attempts integer not null default 1,
      last_error text,
      received_at timestamp with time zone not null default now(),
      processed_at timestamp with time zone,
      updated_at timestamp with time zone not null default now(),
      constraint stripe_webhook_events_status_chk
        check (status in ('processing', 'processed', 'failed'))
    )
  `);
    await client.query(`
    create index if not exists stripe_webhook_events_status_updated_idx
      on stripe_webhook_events using btree (status, updated_at)
  `);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  console.log("Critical schema repair completed.");
} catch (error) {
  console.error("Critical schema repair failed.");
  console.error(error);
  process.exit(1);
} finally {
  await pool.end().catch(() => undefined);
}
