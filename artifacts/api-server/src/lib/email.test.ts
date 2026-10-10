import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dateLabel, esc, escUrl, moneyLabel } from "./email";

const emailSource = readFileSync(
  resolve(fileURLToPath(new URL(".", import.meta.url)), "email.ts"),
  "utf8",
);

/**
 * Escaping for outbound email HTML.
 *
 * Every template interpolated its values raw. Names and project titles are
 * user-controlled - a client types their own contact name, a PM names a
 * project - so a project called
 * `<a href="https://evil.example">Reset your password</a>` rendered as a live
 * link inside a genuine message from this platform, delivered to somebody
 * else. Mail clients strip <script>, which is why this is content spoofing and
 * a phishing vector rather than XSS, and it is no less real for that.
 */
describe("esc", () => {
  it("neutralises a tag", () => {
    expect(esc('<a href="x">hi</a>')).toBe("&lt;a href=&quot;x&quot;&gt;hi&lt;/a&gt;");
  });

  it("escapes the ampersand first, so entities are not doubled", () => {
    // "&lt;" must not come back as "&amp;lt;" — ordering is the whole trick.
    expect(esc("<")).toBe("&lt;");
    expect(esc("&")).toBe("&amp;");
    expect(esc("&lt;")).toBe("&amp;lt;");
  });

  it("escapes both quote characters, for attribute contexts", () => {
    expect(esc('"')).toBe("&quot;");
    expect(esc("'")).toBe("&#39;");
  });

  it("renders an absent value as empty rather than 'undefined'", () => {
    // `opts.name` is frequently blank; "Hi undefined," would be worse than
    // the "there" fallback the templates fall back to on an empty string.
    expect(esc(undefined)).toBe("");
    expect(esc(null)).toBe("");
  });

  it("keeps an empty result falsy, so the `|| \"there\"` fallbacks still fire", () => {
    expect(esc("")).toBe("");
    expect(Boolean(esc(""))).toBe(false);
  });

  it("passes ordinary names through unchanged", () => {
    expect(esc("Ayşe Yılmaz")).toBe("Ayşe Yılmaz");
    expect(esc(3)).toBe("3");
  });
});

describe("escUrl", () => {
  it("allows http and https", () => {
    expect(escUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(escUrl("http://localhost:5173/login")).toBe("http://localhost:5173/login");
  });

  it("refuses a scheme that would execute in a mail client", () => {
    // `inviteUrl` is passed in by a caller, so the scheme is not guaranteed.
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect(escUrl(url), url).toBe("#");
    }
  });

  it("refuses a relative url rather than linking it", () => {
    // A relative href in an email resolves against the mail client, not the
    // app, so it is always broken. The templates prefix APP_URL themselves.
    expect(escUrl("/reset-password?token=abc")).toBe("#");
  });

  it("escapes a quote so a url cannot break out of the href attribute", () => {
    expect(escUrl('https://example.com/"onmouseover="alert(1)')).toContain("&quot;");
    expect(escUrl('https://example.com/"onmouseover="alert(1)')).not.toContain('"onmouseover');
  });

  it("treats a blank or missing url as unusable", () => {
    expect(escUrl("")).toBe("#");
    expect(escUrl(undefined as unknown as string)).toBe("#");
  });
});

/**
 * A drift guard, because escaping one set of templates does not stop the next
 * one being written raw. The templates are plain template literals, so nothing
 * in the type system requires a value to be escaped on its way into HTML.
 */
describe("email templates", () => {
  /** Each `base(...)` block, which is where HTML is assembled. */
  function htmlBlocks(): string[] {
    const blocks: string[] = [];
    const marker = "base(`";
    let from = 0;
    for (;;) {
      const start = emailSource.indexOf(marker, from);
      if (start === -1) break;
      const open = start + marker.length;
      const end = emailSource.indexOf("`)", open);
      expect(end, "unterminated base(`...`) block").toBeGreaterThan(open);
      blocks.push(emailSource.slice(open, end));
      from = end + 2;
    }
    return blocks;
  }

  it("finds the template bodies it means to check", () => {
    // Guards the guard: a refactor that renamed `base` would otherwise make
    // every assertion below vacuously true.
    expect(htmlBlocks().length).toBeGreaterThanOrEqual(6);
  });

  /**
   * Every `${...}` in a block, at any nesting depth.
   *
   * A regex cannot do this. `${cond ? `<p>${esc(x)}</p>` : ""}` contains a `}`
   * inside a nested template literal, so matching `\$\{([^}]*)\}` truncates the
   * expression and reports an escaped value as raw - which is exactly the
   * false positive the first version of this test produced. So walk the text
   * tracking brace depth and backtick nesting instead.
   *
   * An expression containing a backtick is a container (a conditional that
   * builds more HTML), not a value: its own nested interpolations are what
   * reach the output, so recurse rather than demanding esc() on the whole
   * thing.
   */
  function interpolations(block: string): string[] {
    const found: string[] = [];
    for (let i = 0; i < block.length - 1; i += 1) {
      if (block[i] !== "$" || block[i + 1] !== "{") continue;
      let depth = 1;
      let _backticks = 0;
      let j = i + 2;
      for (; j < block.length && depth > 0; j += 1) {
        const ch = block[j];
        if (ch === "\\") { j += 1; continue; }
        if (ch === "`") _backticks += 1;
        else if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
      }
      const expression = block.slice(i + 2, j - 1);
      if (expression.includes("`")) {
        // A container: check what it builds, not the container itself.
        found.push(...interpolations(expression));
      } else {
        found.push(expression.trim());
      }
      i = j - 2;
    }
    return found;
  }

  it("sees through a nested template literal", () => {
    // Guards the guard. If this returned ["a ? `${esc(x)"] the check below
    // would be reporting escaped values as raw.
    expect(interpolations('${cond ? `<p>${esc(x)}</p>` : ""}')).toEqual(["esc(x)"]);
    expect(interpolations("${esc(a)} and ${escUrl(b)}")).toEqual(["esc(a)", "escUrl(b)"]);
  });

  it("escapes every value interpolated into email HTML", () => {
    const raw: string[] = [];
    for (const block of htmlBlocks()) {
      for (const expression of interpolations(block)) {
        // A literal-only ternary interpolates no user data (pluralisation).
        if (/^[^a-zA-Z]*$/.test(expression)) continue;
        if (/\?\s*["'][^"']*["']\s*:\s*["'][^"']*["']$/.test(expression) && !/\$\{/.test(expression)
            && /===?|!==?/.test(expression)) continue;
        if (expression.startsWith("esc(") || expression.startsWith("escUrl(")) continue;
        raw.push(expression);
      }
    }
    expect(raw, `these reach email HTML unescaped: ${raw.join(", ")}`).toEqual([]);
  });

  it("routes every href through the scheme check", () => {
    for (const block of htmlBlocks()) {
      for (const match of block.matchAll(/href="\$\{([^}]*)\}"/g)) {
        expect(
          match[1].trim().startsWith("escUrl("),
          `href is not scheme-checked: ${match[1].trim()}`,
        ).toBe(true);
      }
    }
  });
});

/**
 * Amounts and dates in a transactional email.
 *
 * These render the figure a client is asked to pay, in a message they may
 * treat as the invoice itself, so the formatting is pinned rather than assumed.
 * Both are deliberately fixed-locale: the recipient's locale is not known
 * server-side, and a date that could read as either 03/04 or 04/03 is worse
 * than one spelled out.
 */
describe("moneyLabel", () => {
  it("renders cents as a major-unit amount with the currency code", () => {
    expect(moneyLabel(1200000, "EUR")).toBe("12,000.00 EUR");
    expect(moneyLabel(100, "usd")).toBe("1.00 USD");
  });

  it("always shows two decimal places", () => {
    // "1,250.5 EUR" on an invoice looks like a truncated number.
    expect(moneyLabel(125050, "EUR")).toBe("1,250.50 EUR");
    expect(moneyLabel(0, "EUR")).toBe("0.00 EUR");
  });

  it("spells out the currency rather than guessing a symbol", () => {
    // A bare "$" for a EUR invoice would misstate the amount owed.
    expect(moneyLabel(5000, "TRY")).toBe("50.00 TRY");
    expect(moneyLabel(5000, "GBP")).not.toContain("$");
  });

  it("falls back to USD on a missing code instead of rendering nothing", () => {
    expect(moneyLabel(5000, "")).toBe("50.00 USD");
  });

  it("does not crash on a non-numeric amount", () => {
    expect(moneyLabel(Number.NaN, "EUR")).toBe("0.00 EUR");
  });
});

describe("dateLabel", () => {
  it("spells the month out, so the order cannot be misread", () => {
    expect(dateLabel("2026-03-04T00:00:00.000Z")).toBe("4 March 2026");
  });

  it("returns null when there is no date to show", () => {
    // The templates omit the whole sentence on null rather than printing
    // "due by null".
    expect(dateLabel(null)).toBeNull();
    expect(dateLabel(undefined)).toBeNull();
    expect(dateLabel("")).toBeNull();
  });

  it("returns null for an unparseable value", () => {
    expect(dateLabel("not a date")).toBeNull();
  });
});
