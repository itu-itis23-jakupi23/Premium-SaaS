import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Locale coverage.
 *
 * Regression guard for a real failure: every non-English locale was missing
 * 123 of the 165 `home.*` keys, so switching language left roughly two thirds
 * of the home page in English via `fallbackLng`. The switcher looked broken
 * even though it worked — the translations simply were not there. A second
 * round of 187 keys covering invoices, quotes, the sales pipeline and the
 * public quote form had the same problem in the authenticated dashboards.
 *
 * All ten locales are now held at full parity with en.json, so a new English
 * string fails this suite until it is translated everywhere. `home.*`,
 * `common.*` and `nav.*` are additionally checked on their own, so a failure
 * on the marketing surface — the part an anonymous visitor sees — names itself
 * rather than hiding in a list of several hundred keys.
 */

const LOCALES = ["de", "fr", "es", "it", "pt", "nl", "tr", "zh", "ja", "ar"] as const;

/** Namespaces a logged-out visitor can see. Called out separately so a failure
 *  names the marketing surface explicitly, which is the highest-impact gap. */
const PUBLIC_PREFIXES = ["home.", "common.", "nav."];

function load(code: string): Record<string, unknown> {
  const url = new URL(`./locales/${code}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as Record<string, unknown>;
}

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

const english = flatten(load("en"));
const publicKeys = english.filter((key) => PUBLIC_PREFIXES.some((p) => key.startsWith(p)));

describe("locale coverage", () => {
  it.each(LOCALES)("%s translates every key in en.json", (code) => {
    // Full parity, not just the public surface. The authenticated dashboards
    // (invoices, quotes, pipeline, getQuote) were English-only for a long time;
    // this keeps them from drifting back.
    const present = new Set(flatten(load(code)));
    const missing = english.filter((key) => !present.has(key));
    expect(missing, `${code}.json is missing ${missing.length} of ${english.length} keys`)
      .toEqual([]);
  });

  it("has public keys to check", () => {
    // Guards the guard: a typo in PUBLIC_PREFIXES would make every case vacuous.
    expect(publicKeys.length).toBeGreaterThan(150);
  });

  it.each(LOCALES)("%s translates the whole public surface", (code) => {
    const present = new Set(flatten(load(code)));
    const missing = publicKeys.filter((key) => !present.has(key));
    expect(missing, `${code}.json is missing ${missing.length} public keys`).toEqual([]);
  });

  it.each(LOCALES)("%s keeps interpolation placeholders intact", (code) => {
    const locale = load(code);
    const read = (path: string): unknown =>
      path.split(".").reduce<unknown>((node, part) => {
        if (node === null || typeof node !== "object") return undefined;
        return (node as Record<string, unknown>)[part];
      }, locale);

    // A translation that drops {{percent}} or ${{amount}} renders a broken
    // string at runtime rather than failing loudly, so assert on it here.
    const withPlaceholders = english.filter((key) => {
      const value = read(key);
      return typeof value === "string" && /\{\{\s*\w+\s*\}\}/.test(value);
    });

    for (const key of withPlaceholders) {
      const source = String(read(key));
      const names = [...source.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
      const englishSource = String(
        key.split(".").reduce<unknown>((node, part) => {
          if (node === null || typeof node !== "object") return undefined;
          return (node as Record<string, unknown>)[part];
        }, load("en")),
      );
      const englishNames = [...englishSource.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
        .map((m) => m[1])
        .sort();
      expect(names, `${code} ${key} placeholder mismatch`).toEqual(englishNames);
    }
  });

  it.each(LOCALES)("%s has no key left as its own English source text", (code) => {
    // Catches a locale file that was copied from en.json and never translated:
    // if every public string is byte-identical to English, that is not a
    // translation. A handful legitimately match (brand names, "OCTANORM").
    const locale = load(code);
    const read = (path: string, root: unknown): unknown =>
      path.split(".").reduce<unknown>((node, part) => {
        if (node === null || typeof node !== "object") return undefined;
        return (node as Record<string, unknown>)[part];
      }, root);

    const en = load("en");
    const strings = english.filter((key) => typeof read(key, locale) === "string");
    const identical = strings.filter((key) => read(key, locale) === read(key, en));
    const ratio = identical.length / Math.max(1, strings.length);
    expect(ratio, `${code}: ${identical.length}/${strings.length} strings identical to English`)
      .toBeLessThan(0.5);
  });
});
