/**
 * Booth renderer integrity gate (WS-04).
 *
 * `booth-render.html` drives the entire 3D booth: it is roughly 4,200 lines of
 * inline JavaScript in a standalone HTML file, loaded into an iframe. Because
 * it is HTML rather than a `.ts` module, neither ESLint nor TypeScript sees a
 * single line of it. Every other source file in the repo is parsed by something
 * on every push; this one, the most visible surface in the product, is not.
 *
 * That gap has already broken it once: an edit left an orphaned `});` behind,
 * and nothing caught it until the renderer failed at runtime, inside an iframe,
 * with a blank booth.
 *
 * Two checks, both cheap:
 *
 *   1. Every <script> block parses. Classic blocks are checked as scripts and
 *      `type="module"` blocks as modules, since the two have different rules
 *      (top-level `import` is only legal in a module).
 *
 *   2. Every absolute import the module makes resolves to a file on disk. The
 *      renderer pulls Three.js through `/src/workspace/*-proxy.ts` shims using
 *      root-absolute paths that Vite resolves at serve time. Nothing else in
 *      the codebase imports those shims, so a rename or a tidy-up that looks
 *      safe - the files read as orphaned by any normal usage search - would
 *      leave the booth importing a path that no longer exists.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landingRoot = resolve(root, "artifacts", "ens-landing");
const renderPath = resolve(landingRoot, "booth-render.html");

const failures = [];

if (!existsSync(renderPath)) {
  console.error(`Booth renderer check failed:\n  - missing ${renderPath}`);
  process.exit(1);
}

const html = readFileSync(renderPath, "utf8");

/** Every <script> block, with the line it starts on and whether it is a module. */
function scriptBlocks(source) {
  const blocks = [];
  const open = /<script\b([^>]*)>/gi;
  let match;
  while ((match = open.exec(source)) !== null) {
    const attrs = match[1] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue; // external, nothing inline to parse
    const start = match.index + match[0].length;
    const end = source.indexOf("</script>", start);
    if (end === -1) {
      blocks.push({ line: lineOf(source, match.index), unterminated: true });
      continue;
    }
    blocks.push({
      code: source.slice(start, end),
      line: lineOf(source, start),
      isModule: /\btype\s*=\s*["']module["']/i.test(attrs),
    });
    open.lastIndex = end;
  }
  return blocks;
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

const blocks = scriptBlocks(html);
if (blocks.length === 0) {
  failures.push("no inline <script> blocks found - has the renderer been restructured?");
}

const scratch = mkdtempSync(join(tmpdir(), "booth-render-"));
try {
  for (const block of blocks) {
    if (block.unterminated) {
      failures.push(`<script> opened at line ${block.line} is never closed`);
      continue;
    }

    // Pad with newlines so the parser reports lines matching the HTML file.
    const padded = "\n".repeat(block.line - 1) + block.code;
    const file = join(scratch, `block-${block.line}.${block.isModule ? "mjs" : "cjs"}`);
    writeFileSync(file, padded, "utf8");

    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (error) {
      const detail = String(error.stderr ?? error.message)
        .split("\n")
        .map((l) => l.replace(file, "booth-render.html"))
        .find((l) => /SyntaxError|Error:/.test(l));
      failures.push(
        `<script${block.isModule ? ' type="module"' : ""}> at line ${block.line} does not parse: ` +
          (detail ?? "unknown syntax error"),
      );
    }

    if (!block.isModule) continue;

    // Root-absolute imports are resolved by Vite from the package root.
    const specifiers = [...block.code.matchAll(/(?:from\s*|import\s*)['"](\/[^'"]+)['"]/g)];
    for (const [, specifier] of specifiers) {
      const target = resolve(landingRoot, `.${specifier}`);
      if (!existsSync(target)) {
        failures.push(
          `import "${specifier}" (line ${block.line} block) resolves to a file that does not exist: ` +
            target.replace(root, "."),
        );
      }
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error("Booth renderer check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  const modules = blocks.filter((b) => b.isModule).length;
  console.log(
    `Booth renderer check passed: ${blocks.length} inline script block(s) parse ` +
      `(${modules} module), and every absolute import resolves.`,
  );
}
