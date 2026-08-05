import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsPath = resolve(root, "lib/db/migrations");
const journalPath = resolve(migrationsPath, "meta/_journal.json");

const sqlTags = readdirSync(migrationsPath)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .map((name) => name.slice(0, -4))
  .sort();
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const entries = Array.isArray(journal.entries) ? journal.entries : [];
const journalTags = entries.map((entry) => entry.tag);
const errors = [];

if (entries.length !== sqlTags.length) {
  errors.push(`journal has ${entries.length} entries but ${sqlTags.length} SQL migrations exist`);
}

for (const [index, entry] of entries.entries()) {
  if (entry.idx !== index) errors.push(`journal index ${index} declares idx=${entry.idx}`);
  if (entry.tag !== sqlTags[index]) {
    errors.push(`journal index ${index} expects ${sqlTags[index] ?? "<missing>"} but declares ${entry.tag ?? "<missing>"}`);
  }
  if (index > 0 && Number(entry.when) <= Number(entries[index - 1].when)) {
    errors.push(`journal timestamp for ${entry.tag} is not strictly increasing`);
  }
}

for (const tag of new Set(journalTags)) {
  if (journalTags.filter((candidate) => candidate === tag).length > 1) errors.push(`duplicate journal tag ${tag}`);
}

const timestamps = entries.map((entry) => String(entry.when));
for (const timestamp of new Set(timestamps)) {
  if (timestamps.filter((candidate) => candidate === timestamp).length > 1) {
    errors.push(`duplicate journal timestamp ${timestamp}`);
  }
}

if (errors.length) {
  console.error("Migration journal check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Migration journal check passed: ${entries.length} ordered migrations.`);
