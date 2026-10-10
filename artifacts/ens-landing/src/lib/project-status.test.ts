import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROJECT_STAGES,
  PROJECT_STATUS_STYLES,
  UNKNOWN_PROJECT_STATUS_STYLE,
  projectStatusLabel,
  projectStatusStyle,
} from "./project-status";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "..");

/** The `project_status` enum, read from the schema rather than restated here. */
function projectStatusEnum(): string[] {
  const schema = readFileSync(resolve(repoRoot, "lib", "db", "src", "schema", "index.ts"), "utf8");
  const block = schema.match(/pgEnum\(\s*["']project_status["']\s*,\s*\[([\s\S]*?)\]\s*\)/);
  expect(block, "could not read the project_status enum from the schema").toBeTruthy();
  const values = [...block![1].matchAll(/["']([a-z_]+)["']/g)].map((match) => match[1]);
  expect(values.length).toBeGreaterThan(5);
  return values;
}

/**
 * The status badge a client reads on their project list.
 *
 * This exists because of a real defect: the colour map held four labels and
 * everything else fell through a fallback to Active's green. Ten of the
 * fourteen possible labels therefore rendered green, so a cancelled or delayed
 * project looked exactly like a healthy one. A locale test already proved every
 * status has a *word*; nothing proved it has the right *colour*.
 */
describe("project status styles", () => {
  it("styles every status the database can hold", () => {
    const missing = projectStatusEnum()
      .map(projectStatusLabel)
      .filter((label) => !(label in PROJECT_STATUS_STYLES));

    expect(missing, `these statuses would render in the fallback colour: ${missing.join(", ")}`)
      .toEqual([]);
  });

  it("does not colour a cancelled or delayed project like a healthy one", () => {
    // The specific failure that prompted this file.
    expect(projectStatusStyle("Cancelled")).not.toEqual(projectStatusStyle("Active"));
    expect(projectStatusStyle("Delayed")).not.toEqual(projectStatusStyle("Active"));
    expect(projectStatusStyle("Cancelled").text).toBe(projectStatusStyle("Delayed").text);
  });

  it("falls back to neutral rather than to a status that means something", () => {
    // An unmapped label must not borrow the meaning of a mapped one.
    const fallback = projectStatusStyle("Something The API Invented");
    expect(fallback).toEqual(UNKNOWN_PROJECT_STATUS_STYLE);
    expect(fallback).not.toEqual(projectStatusStyle("Active"));
    expect(fallback).not.toEqual(projectStatusStyle("Cancelled"));
  });

  it("gives every mapped status a complete style", () => {
    for (const [label, style] of Object.entries(PROJECT_STATUS_STYLES)) {
      expect(style.bg, `${label} bg`).toMatch(/^rgba?\(/);
      expect(style.text, `${label} text`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.border, `${label} border`).toMatch(/^rgba?\(/);
    }
  });
});

describe("projectStatusLabel", () => {
  it("title-cases the stored enum value", () => {
    expect(projectStatusLabel("client_review")).toBe("Client Review");
    expect(projectStatusLabel("in_production")).toBe("In Production");
    expect(projectStatusLabel("draft")).toBe("Draft");
  });

  it("matches the labels the status map is keyed by", () => {
    // The lifecycle timeline builds a translation key from this, so a mismatch
    // shows the client a raw key.
    expect(projectStatusLabel("in_design") in PROJECT_STATUS_STYLES).toBe(true);
    expect(projectStatusLabel("cancelled") in PROJECT_STATUS_STYLES).toBe(true);
  });

  it("lowercases the tail, as the server's toTitle does", () => {
    // Matching the server matters more than looking right: the label is a
    // translation key, and "IN_DESIGN" must land on the same key as "in_design".
    expect(projectStatusLabel("IN_DESIGN")).toBe("In Design");
  });

  it("survives empty and separator-only input", () => {
    expect(projectStatusLabel("")).toBe("");
    expect(projectStatusLabel("__")).toBe("");
  });
});

describe("pipeline stages", () => {
  it("lists the five stages the API normalises to", () => {
    // normalizePipelineStage in the API collapses everything onto these, and
    // the client timeline builds `client.projects.stage.<stage>` from them.
    expect([...PROJECT_STAGES]).toEqual(["intake", "design", "review", "production", "closed"]);
  });
});
