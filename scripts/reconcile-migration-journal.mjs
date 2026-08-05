import { createHash } from "node:crypto";
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
  console.error("DATABASE_URL is required. Set it in .env or in the shell before running this command.");
  process.exit(1);
}

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const orderedEntries = [...journal.entries].sort((a, b) => a.idx - b.idx);
const requireFromDb = createRequire(resolve(root, "lib/db/package.json"));
const { Pool } = requireFromDb("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const markerSql = `
  select
    to_regclass('public.users') is not null
      and exists(select 1 from pg_type where typname = 'approval_status') as m0000,
    to_regclass('public.direct_conversations') is not null as m0001,
    to_regclass('public.clients_org_status_updated_idx') is not null as m0002,
    exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'direct_messages' and column_name = 'attachments') as m0003,
    exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'workspace_editor_subscription_active') as m0004,
    to_regclass('public.project_assignment_history') is not null as m0005,
    exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'intake_exhibition_name') as m0006,
    exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'pm_capacity_limit') as m0007,
    to_regclass('public.password_reset_tokens') is not null
      and to_regclass('public.password_reset_tokens_token_hash_unique') is not null
      and to_regclass('public.idx_prt_token_hash') is not null
      and to_regclass('public.idx_prt_user_id') is not null
      and exists (
        select 1 from pg_constraint
        where conname = 'password_reset_tokens_user_id_users_id_fk'
      ) as m0008,
    to_regclass('public.clients_org_email_unique') is not null as m0009,
    to_regclass('public.login_rate_limits') is not null
      and to_regclass('public.login_rate_limits_window_idx') is not null as m0010,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'invitations' and column_name = 'name'
    ) as m0011,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'direct_conversations' and column_name = 'project_id'
    )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'direct_conversations' and column_name = 'exhibition_key'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'direct_conversations' and column_name = 'exhibition_name'
      )
      and to_regclass('public.direct_conversations_org_pair_scope_unique_idx') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'direct_messages' and column_name = 'attachments'
      )
      and to_regclass('public.direct_conversations_participant_one_idx') is not null
      and to_regclass('public.direct_conversations_participant_two_idx') is not null
      and to_regclass('public.direct_messages_conversation_created_idx') is not null
      and to_regclass('public.direct_messages_unread_idx') is not null
      and to_regclass('public.stripe_webhook_events') is not null
      and to_regclass('public.stripe_webhook_events_status_updated_idx') is not null
      and exists (
        select 1 from pg_constraint where conname = 'stripe_webhook_events_status_chk'
      ) as m0012,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'invitations' and column_name = 'email_status'
    )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'invitations' and column_name = 'email_last_error'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'invitations' and column_name = 'email_last_attempt_at'
      )
      and exists (
        select 1 from pg_constraint where conname = 'invitations_email_status_chk'
      )
      and to_regclass('public.invitations_org_email_status_idx') is not null as m0013,
    to_regclass('public.documents') is not null
      and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'documents' and column_name = 'name'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'documents' and column_name = 'organization_id' and is_nullable = 'NO'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'documents' and column_name = 'project_id' and is_nullable = 'YES'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'documents' and column_name = 'file_name' and is_nullable = 'NO'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'documents' and column_name = 'mime_type' and is_nullable = 'NO'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'documents' and column_name = 'visibility' and is_nullable = 'NO'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'documents' and column_name = 'storage_bucket' and is_nullable = 'NO'
      ) as m0014
`;

try {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('premium_saas_migration_reconcile'))");

    const journalTable = await client.query("select to_regclass('drizzle.__drizzle_migrations') as name");
    if (!journalTable.rows[0]?.name) {
      throw new Error("Drizzle migration journal does not exist; run db:migrate on a clean database instead.");
    }

    const current = await client.query("select coalesce(max(created_at), 0)::text as latest from drizzle.__drizzle_migrations");
    const latest = Number(current.rows[0]?.latest || 0);
    const pendingEntries = orderedEntries.filter((entry) => Number(entry.when) > latest);
    if (pendingEntries.length === 0) {
      await client.query("commit");
      console.log("Migration journal already contains every repository migration; no reconciliation needed.");
      process.exitCode = 0;
    } else {
      const markers = (await client.query(markerSql)).rows[0] ?? {};
      const verifiedEntries = [];
      const missingEntries = [];
      let foundMissing = false;

      for (const entry of pendingEntries) {
        const marker = `m${String(entry.idx).padStart(4, "0")}`;
        const present = markers[marker] === true;
        if (!present) {
          foundMissing = true;
          missingEntries.push(entry.tag);
          continue;
        }
        if (foundMissing) {
          throw new Error(
            `Refusing to reconcile a non-contiguous schema: ${entry.tag} is present after missing migration marker(s): ${missingEntries.join(", ")}.`,
          );
        }
        verifiedEntries.push(entry);
      }

      if (verifiedEntries.length === 0) {
        await client.query("commit");
        console.log("No unjournaled contiguous migrations were detected; run db:migrate normally.");
        process.exitCode = 0;
      } else {
        for (const entry of verifiedEntries) {
        const sql = readFileSync(resolve(migrationsPath, `${entry.tag}.sql`), "utf8");
        const hash = createHash("sha256").update(sql).digest("hex");
        await client.query(
          `insert into drizzle.__drizzle_migrations (hash, created_at)
           select $1, $2
           where not exists (
             select 1 from drizzle.__drizzle_migrations where hash = $1 or created_at = $2
           )`,
          [hash, Number(entry.when)],
        );
      }

        await client.query("commit");
        console.log(`Reconciled ${verifiedEntries.length} verified migration journal entries without changing application data.`);
      }
    }
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error("Migration journal reconciliation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => undefined);
}
