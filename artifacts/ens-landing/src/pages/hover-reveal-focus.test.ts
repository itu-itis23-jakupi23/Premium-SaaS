import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

/**
 * Row actions that appear on hover must also appear on focus (WCAG 2.4.7,
 * Focus Visible).
 *
 * Table and card rows across the app reveal their action buttons with
 * `opacity-0 group-hover:opacity-100`. Hover has no keyboard equivalent, so
 * without `focus-within:opacity-100` a keyboard user tabs into buttons that
 * are fully transparent - the controls take focus, activate, and are never
 * visible. It looked like focus had vanished into the page.
 *
 * Fading a decorative *icon* inside a button that is itself always visible is
 * fine, so this only fails when the fade is on a container element that wraps
 * something focusable. The owning tag is resolved by walking back to the
 * nearest JSX opening tag: lowercase names are containers, capitalised ones are
 * icon components like <ArrowRight />, whose own opacity says nothing about
 * whether the button around them is visible.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

/** Focusable markup appearing within a few lines of the faded container. */
const FOCUSABLE = /<(button|a\s|Link|input|select|textarea)/;

/** Container elements whose opacity really does hide their descendants. */
const CONTAINERS = new Set(["div", "span", "td", "li", "section"]);

/** Walks back to the JSX tag the className on `index` belongs to. */
function owningTag(lines: string[], index: number): string | null {
  for (let i = index; i >= Math.max(0, index - 3); i -= 1) {
    const tags = [...lines[i].matchAll(/<([A-Za-z][A-Za-z0-9]*)/g)];
    if (tags.length) return tags[tags.length - 1][1];
  }
  return null;
}

function offenders(): string[] {
  const found: string[] = [];
  for (const file of tsxFiles(SRC)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!line.includes("group-hover:opacity-100")) return;
      if (!line.includes("opacity-0")) return;
      const tag = owningTag(lines, index);
      if (!tag || !CONTAINERS.has(tag)) return; // an icon fading inside a visible button
      if (line.includes("focus-within:opacity-100") || line.includes("focus:opacity-100")) return;
      const window = lines.slice(index, index + 18).join("\n");
      if (!FOCUSABLE.test(window)) return; // decorative overlay, nothing to focus
      found.push(`${relative(SRC, file).replace(/\\/g, "/")}:${index + 1}`);
    });
  }
  return found;
}

describe("hover-revealed row actions", () => {
  it("stay visible when focused by keyboard", () => {
    expect(
      offenders(),
      "add focus-within:opacity-100 so keyboard users can see these controls",
    ).toEqual([]);
  });
});
