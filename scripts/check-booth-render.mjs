/**
 * Booth renderer integrity gate (WS-04).
 *
 * The booth renderer is a page, `booth-render.html`, plus the engine it loads,
 * `public/booth-render.js` - roughly 3,700 lines of plain JavaScript that draw
 * the entire 3D booth inside an iframe. Neither ESLint nor TypeScript reads
 * either one: the page is HTML, and the engine is a public asset copied
 * verbatim. Every other source file in the repo is parsed by something on every
 * push; the most visible surface in the product is not.
 *
 * That gap has already broken it once: an edit left an orphaned `});` behind,
 * and nothing caught it until the renderer failed at runtime, inside an iframe,
 * with a blank booth.
 *
 * Three checks, all cheap:
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
 *
 *   3. Every shortcut action the renderer forwards is handled by the workspace,
 *      so a key cannot be swallowed by preventDefault() and then do nothing.
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

const scratch = mkdtempSync(join(tmpdir(), "booth-render-"));
const blocks = scriptBlocks(html);
if (blocks.length === 0) {
  failures.push("no inline <script> blocks found - has the renderer been restructured?");
}

// The engine itself lives beside the page rather than inside it, so that the
// app can run under an enforced Content-Security-Policy. It carries the bulk of
// the renderer, so a gate that only reads the page checks almost nothing.
const enginePath = resolve(landingRoot, "public", "booth-render.js");
if (!existsSync(enginePath)) {
  failures.push("public/booth-render.js is missing - the page loads it as a classic script");
} else {
  if (!/<script\s+src=["']\/booth-render\.js["']><\/script>/.test(html)) {
    failures.push("booth-render.html no longer loads /booth-render.js");
  }
  const engineFile = join(scratch, "engine.cjs");
  writeFileSync(engineFile, readFileSync(enginePath, "utf8"), "utf8");
  try {
    execFileSync(process.execPath, ["--check", engineFile], { stdio: "pipe" });
  } catch (error) {
    const detail = String(error.stderr ?? error.message)
      .split("\n")
      .map((l) => l.replace(engineFile, "public/booth-render.js"))
      .find((l) => /SyntaxError|Error:/.test(l));
    failures.push(`public/booth-render.js does not parse: ${detail ?? "unknown syntax error"}`);
  }
}

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

/**
 * 3. Every shortcut the renderer forwards is handled by the workspace.
 *
 * Clicking the booth moves focus into the iframe, so the renderer forwards key
 * presses to the parent as `{type:'workspaceShortcut', action}`. An action it
 * sends that the workspace does not handle is a key that silently does
 * nothing - and the renderer calls preventDefault() first, so it also swallows
 * whatever the browser would otherwise have done. `[` and `]` sat in exactly
 * that state for a full development cycle: forwarded, advertised beside the
 * rotate buttons, handled nowhere.
 *
 * The workspace dispatches some actions by equality and others through a
 * lookup table, so both forms are collected.
 *
 * Scope, so nobody over-trusts this: it catches an action handled *nowhere*,
 * which is the failure that actually shipped. It cannot tell whether a handler
 * is correct - an action still named anywhere in the file counts as handled.
 */
if (existsSync(enginePath)) {
  const workspacePath = resolve(landingRoot, "src", "pages", "pm", "PMWorkspace.tsx");
  if (!existsSync(workspacePath)) {
    failures.push("src/pages/pm/PMWorkspace.tsx is missing");
  } else {
    const engineSource = readFileSync(enginePath, "utf8");
    const workspace = readFileSync(workspacePath, "utf8");

    if (!/postMessage\(\s*\{\s*type:\s*['"]workspaceShortcut['"]/.test(engineSource)) {
      failures.push(
        "booth-render.js no longer posts workspaceShortcut - this check needs updating",
      );
    }

    const forwarded = new Set(
      [...engineSource.matchAll(/action\s*=\s*[^;\n]*?['"]([a-z][a-z-]{2,})['"]/g)].map(
        (match) => match[1],
      ),
    );
    const handled = new Set([
      ...[...workspace.matchAll(/action\s*===\s*['"]([a-z][a-z-]{2,})['"]/g)].map((m) => m[1]),
      ...[...workspace.matchAll(/['"]([a-z][a-z-]{2,})['"]\s*:\s*\[/g)].map((m) => m[1]),
    ]);

    if (forwarded.size === 0) {
      failures.push(
        "no forwarded shortcut actions found in booth-render.js - this check needs updating",
      );
    }

    const unhandled = [...forwarded].filter((action) => !handled.has(action)).sort();
    if (unhandled.length > 0) {
      failures.push(
        `the renderer forwards shortcut action(s) the workspace never handles: ${unhandled.join(", ")}. ` +
          "preventDefault() swallows the key and then nothing happens.",
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Booth renderer check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  const modules = blocks.filter((b) => b.isModule).length;
  console.log(
    `Booth renderer check passed: ${blocks.length} inline script block(s) parse ` +
      `(${modules} module), every absolute import resolves, and every forwarded shortcut is handled.`,
  );
}
