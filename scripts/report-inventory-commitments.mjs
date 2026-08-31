// Reports how many of each catalogue item are committed to overlapping shows.
//
// There is no inventory system: no stock table, no reservations, and the only
// `stock` value in the product is a frontend constant of 99 checked against the
// booth being edited. So nothing anywhere notices when the same forty chairs are
// promised to two exhibitions in the same week - not at quote time, not at
// approval, not at invoicing. It surfaces when someone loads a truck.
//
// Building enforcement needs commercial decisions this script deliberately does
// not make: whether a draft holds stock or only an approved design, for how
// long, what happens when a revision window lapses, who may oversell on
// purpose. This asserts none of that. It measures, so that those decisions can
// be made against evidence rather than a guess about whether the problem is
// real.
//
// An item is treated as committed for a project's whole occupancy window -
// move-in to move-out, not just the show days - because that is when the
// furniture is physically away from the workshop. Where a project has no linked
// exhibition, its own start and deadline dates are used instead.
//
// Usage: pnpm run report:inventory
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { peakConcurrent } from "./lib/commitment-windows.mjs";

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
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

/** Only these project states represent a real promise to a client. */
const COMMITTING_STATUSES = ["client_review", "revision", "approved", "in_production"];

/**
 * One row per item per project, with the window that project occupies it for.
 *
 * The layout lives in booth_versions.layout_json as a placedItems array, so the
 * quantities are expanded out of the jsonb rather than joined from a table.
 * Only the newest version of each design counts: earlier ones are superseded,
 * and summing them would report the same chair several times over.
 */
const COMMITMENTS = `
  with latest as (
    select distinct on (bv.design_id)
      bv.design_id, bv.project_id, bv.layout_json
    from booth_versions bv
    order by bv.design_id, bv.version_number desc
  ),
  windows as (
    select
      p.id as project_id,
      p.name as project_name,
      p.status::text as project_status,
      coalesce(e.name, p.exhibition_name, 'Unscheduled') as show_name,
      coalesce(e.move_in_at, p.starts_at, p.created_at)                 as starts_at,
      coalesce(e.move_out_at, e.closes_at, p.deadline_at, p.starts_at)  as ends_at
    from projects p
    left join exhibitions e on e.id = p.exhibition_id and e.deleted_at is null
    where p.deleted_at is null
      and p.status::text = any($1::text[])
  )
  select
    item ->> 'catalogId'                          as catalog_id,
    coalesce(item ->> 'name', item ->> 'catalogId') as item_name,
    w.project_id::text                            as project_id,
    w.project_name,
    w.project_status,
    w.show_name,
    w.starts_at,
    w.ends_at,
    sum(coalesce((item ->> 'qty')::int, 1))::int  as quantity
  from latest l
  join windows w on w.project_id = l.project_id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(l.layout_json -> 'placedItems') = 'array'
        then l.layout_json -> 'placedItems'
      else '[]'::jsonb
    end
  ) as item
  where item ->> 'catalogId' is not null
    and w.starts_at is not null
    and w.ends_at is not null
  group by 1, 2, 3, 4, 5, 6, 7, 8
`;

const date = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "?");

async function main() {
  await client.connect();
  const { rows } = await client.query(COMMITMENTS, [COMMITTING_STATUSES]);

  if (rows.length === 0) {
    console.log("No committed furniture found.");
    console.log(`Counted projects in: ${COMMITTING_STATUSES.join(", ")}.`);
    console.log("Either nothing has reached those states yet, or no saved design holds catalogue items.");
    return;
  }

  const byItem = new Map();
  for (const row of rows) {
    if (!byItem.has(row.catalog_id)) byItem.set(row.catalog_id, []);
    byItem.get(row.catalog_id).push(row);
  }

  const report = [...byItem.entries()]
    .map(([catalogId, itemRows]) => {
      const peak = peakConcurrent(itemRows);
      return {
        catalogId,
        name: itemRows[0].item_name,
        peak: peak.quantity,
        at: peak.at,
        concurrentProjects: peak.rows.length,
        total: itemRows.reduce((sum, row) => sum + row.quantity, 0),
        rows: peak.rows,
      };
    })
    .sort((a, b) => b.peak - a.peak || b.concurrentProjects - a.concurrentProjects);

  const contended = report.filter((entry) => entry.concurrentProjects > 1);

  console.log(`Committed furniture across ${byItem.size} catalogue item(s), ${rows.length} project commitment(s).`);
  console.log(`Counting projects in: ${COMMITTING_STATUSES.join(", ")}.\n`);
  console.log("item                                 peak  at           shows  total");
  console.log("-".repeat(76));
  for (const entry of report.slice(0, 30)) {
    const label = `${entry.name} (${entry.catalogId})`.slice(0, 36).padEnd(36);
    console.log(
      `${label} ${String(entry.peak).padStart(4)}  ${date(entry.at)}  ` +
      `${String(entry.concurrentProjects).padStart(5)}  ${String(entry.total).padStart(5)}`,
    );
  }

  if (contended.length === 0) {
    console.log("\nNo item is committed to more than one show at a time.");
    console.log("Nothing here needs an inventory system yet - which is itself the finding.");
    return;
  }

  console.log(`\n${contended.length} item(s) are wanted by more than one show at once:\n`);
  for (const entry of contended.slice(0, 10)) {
    console.log(`  ${entry.name} (${entry.catalogId}) - ${entry.peak} needed around ${date(entry.at)}`);
    for (const row of entry.rows) {
      console.log(
        `      ${String(row.quantity).padStart(3)} x  ${date(row.starts_at)} to ${date(row.ends_at)}  ` +
        `${row.show_name} - ${row.project_name} [${row.project_status}]`,
      );
    }
  }
  console.log(
    "\nThis is demand, not a shortage: the product holds no stock figures, so nothing\n" +
    "here can say whether these peaks exceed what the workshop owns. It shows where\n" +
    "a real inventory system would have to hold a line, and how often.",
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.end().catch(() => {}));
