import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, sep } from "node:path";
import { FURNITURE_CATEGORY_ORDER } from "../pages/pm/workspace-constants";

/**
 * Key usage: does every key the code asks for actually exist?
 *
 * locale-coverage.test.ts checks the other axis - that all ten locales match
 * en.json - and it is a good test. It simply cannot see this class of gap,
 * because a key that is in none of the catalogues is missing from all of them
 * equally, so parity holds and the suite stays green while the interface shows
 * a raw dotted identifier to the user.
 *
 * That is what had happened. Thirteen keys resolved nowhere, including both
 * generic error messages on the logged-out password-reset path, and the client
 * project list rendered `client.projects.status.Planning` where a status
 * should have been.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "..");
const repoRoot = resolve(here, "..", "..", "..", "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "node_modules") out.push(...sourceFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function flatten(value: unknown, prefix = "", out: Set<string> = new Set()): Set<string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    out.add(prefix);
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

/**
 * English lives in three files: en.json ships with the first load, en.app.json
 * arrives with any authenticated page and en.staff.json with the chief and PM
 * pages (CS-14). Together they are the catalogue,
 * so every check here reads the pair as one - splitting it for weight must not
 * create a blind spot where a key is "missing" only because it moved.
 */
const english = new Set(
  ["en.json", "en.app.json", "en.staff.json"].flatMap((name) => [
    ...flatten(JSON.parse(readFileSync(resolve(here, "locales", name), "utf8"))),
  ]),
);

/**
 * i18next resolves a plural key through a suffixed variant, so `t("x", {count})`
 * is satisfied by `x_one` / `x_other` and never by a bare `x`. Comparing base
 * keys literally reports those as missing when they are fine.
 */
const PLURAL_SUFFIXES = ["", "_one", "_other", "_plural", "_zero", "_two", "_few", "_many"];
const resolves = (key: string) => PLURAL_SUFFIXES.some((suffix) => english.has(key + suffix));

describe("translation keys the code asks for", () => {
  it("every literal t() key resolves in en.json", () => {
    const missing: string[] = [];
    for (const file of sourceFiles(srcRoot)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\(\s*["']([A-Za-z0-9_.\-]+)["']/g)) {
        const key = match[1];
        if (resolves(key)) continue;
        const line = source.slice(0, match.index).split("\n").length;
        missing.push(`${key}  (${file.split(sep).join("/").replace(`${repoRoot.split(sep).join("/")}/`, "")}:${line})`);
      }
    }
    expect(missing, `these keys render as raw text:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  /**
   * The client project list builds its key from the project's status, which the
   * API produces by title-casing the `project_status` enum. Static analysis
   * cannot follow that, so this drives the check from the enum itself: every
   * value the database can hold has to have a label a client can read.
   */
  it("every project_status the API can return has a client-facing label", () => {
    const schema = readFileSync(
      resolve(repoRoot, "lib", "db", "src", "schema", "index.ts"),
      "utf8",
    );
    const block = schema.match(/pgEnum\(\s*["']project_status["']\s*,\s*\[([\s\S]*?)\]\s*\)/);
    expect(block, "could not read the project_status enum from the schema").toBeTruthy();

    const values = [...block![1].matchAll(/["']([a-z_]+)["']/g)].map((m) => m[1]);
    expect(values.length).toBeGreaterThan(5);

    // Mirrors toTitle() in artifacts/api-server/src/routes/platform.ts.
    const toTitle = (value: string) =>
      value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");

    const missing = values
      .map(toTitle)
      .filter((label) => !english.has(`client.projects.status.${label}`));

    expect(
      missing,
      `a client would see a raw key for these statuses: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every furniture category in the catalogue order has a label", () => {
    const missing = FURNITURE_CATEGORY_ORDER.filter(
      (category) => !english.has(`pm.workspace.furnitureCategory.${category}`),
    );
    expect(
      missing,
      `the workspace catalogue would show a raw key for: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
