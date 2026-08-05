// Purges e2e/smoke test data from the development database.
//
// Deletes users whose email matches the throwaway patterns used by the
// Playwright/smoke suites, organizations whose entire membership consists of
// such users, and orphaned organizations left behind with test-style slugs.
// Everything runs in one transaction; on any FK conflict nothing is changed.
//
// Usage: pnpm run db:clean-test-data
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

const JUNK_EMAIL_CONDITION = `
  email LIKE 'smoke.%@example.com'
  OR email LIKE '%@workflow.test'
  OR email LIKE '%@e2e.test'
`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  const preview = await client.query(
    `SELECT count(*)::int AS n FROM users WHERE ${JUNK_EMAIL_CONDITION}`,
  );
  const junkUserCount = preview.rows[0].n;
  if (junkUserCount === 0) {
    console.log("No test users found — database is already clean.");
    return;
  }
  console.log(`Found ${junkUserCount} test users to remove.`);

  await client.query("BEGIN");
  try {
    await client.query(
      `CREATE TEMP TABLE junk_users ON COMMIT DROP AS
         SELECT id FROM users WHERE ${JUNK_EMAIL_CONDITION}`,
    );

    // Organizations where every member is a junk user (covers orgs the e2e
    // suites created), plus memberless orgs with test-style slugs.
    await client.query(
      `CREATE TEMP TABLE junk_orgs ON COMMIT DROP AS
         SELECT o.id FROM organizations o
         WHERE (
           EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = o.id)
           AND NOT EXISTS (
             SELECT 1 FROM memberships m
             WHERE m.organization_id = o.id
               AND m.user_id NOT IN (SELECT id FROM junk_users)
           )
         ) OR (
           NOT EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = o.id)
           AND (o.slug ILIKE '%workflow%' OR o.slug ILIKE '%e2e%' OR o.slug ILIKE '%smoke%' OR o.slug ILIKE '%codex%')
         )`,
    );

    const orgResult = await client.query(
      `DELETE FROM organizations WHERE id IN (SELECT id FROM junk_orgs)`,
    );
    const userResult = await client.query(
      `DELETE FROM users WHERE id IN (SELECT id FROM junk_users)`,
    );

    await client.query("COMMIT");
    console.log(`Removed ${orgResult.rowCount} test organizations (cascaded to their projects, clients, sessions, …).`);
    console.log(`Removed ${userResult.rowCount} test users.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cleanup aborted, nothing was deleted:", error.message);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
