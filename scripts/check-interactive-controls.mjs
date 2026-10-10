/**
 * Every control must do something, and must be one control.
 *
 * Two failures this catches, both of which look fine in a screenshot and are
 * broken in use:
 *
 *   dead      a <button> with no handler, no submit, no asChild and not
 *             disabled. It renders, it hovers, it depresses, and nothing
 *             happens. Worse than not drawing it, because the user concludes
 *             the product is broken rather than that the feature is absent.
 *
 *   nested    a <button> inside a <Link> or <a>. Invalid HTML: the browser
 *             gives one action two tab stops, and a screen reader announces a
 *             link containing a button, which describes nothing the user can
 *             act on. Use <Button asChild><Link/></Button>, or put the styling
 *             on the Link.
 *
 * Deliberately a source check rather than a bundle check: the point is to tell
 * whoever wrote it, in the file they wrote it in.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = resolve(root, "artifacts/ens-landing/src");

/** The design-system primitives forward props; they are not call sites. */
const EXEMPT_DIRS = ["components/ui"];

const OPEN_NAME = /<(Button|button)(?=[\s/>])/g;
const HANDLER = /\bon[A-Z][A-Za-z]+\s*=/;
const SUBMIT = /type\s*=\s*["{]?\s*["']?submit/;
const AS_CHILD = /\basChild\b/;
/** A disabled control is deliberately inert, not dead. */
const DISABLED = /\bdisabled\b/;
const NESTED = /<(?:Link|a)\b[^>]*>\s*(?:\{[^}]*\}\s*)?<(?:button|Button)\b/gs;

/**
 * Radix triggers take their behaviour from the parent component, so a trigger
 * with no handler of its own is correct rather than dead.
 */
const TRIGGERS = [
  "DialogTrigger", "PopoverTrigger", "DropdownMenuTrigger", "SelectTrigger",
  "TooltipTrigger", "SheetTrigger", "AlertDialogTrigger", "CollapsibleTrigger",
  "AccordionTrigger",
];

/**
 * The props of an opening tag, from just after "<button" to its closing ">".
 *
 * Scanned rather than matched by regex because an arrow function in a prop
 * contains ">" — `onClick={() => ...}` — and a naive [^>]* stops there, hiding
 * every handler written that way. That produced three false positives on the
 * first run, which is exactly how a check like this ends up switched off.
 */
function openingTagProps(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== "\\") quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
    } else if (ch === ">" && depth === 0) {
      return text.slice(start, i);
    }
  }
  return text.slice(start);
}

/**
 * Blank out block comments, keeping length and line breaks so reported line
 * numbers stay true.
 *
 * A JSX comment is a block comment inside braces, and this codebase has one
 * that literally reads "so the export <Button> is not nested inside a
 * <button>" - prose about the rule, which the scanner read as two dead
 * controls. Line comments are left alone: blanking from "//" would swallow the
 * rest of a line containing a URL, and could hide a real control after it.
 */
function withoutBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    block.replace(/[^\n]/g, " "),
  );
}

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "node_modules") out.push(...sourceFiles(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

const failures = [];
let checked = 0;

for (const file of sourceFiles(srcRoot)) {
  const rel = relative(srcRoot, file).replace(/\\/g, "/");
  if (EXEMPT_DIRS.some((d) => rel.startsWith(`${d}/`))) continue;
  const text = withoutBlockComments(readFileSync(file, "utf8"));
  const lineOf = (index) => text.slice(0, index).split("\n").length;

  for (const match of text.matchAll(NESTED)) {
    failures.push({
      kind: "nested",
      where: `${rel}:${lineOf(match.index)}`,
      detail: "a button inside a link — use <Button asChild><Link/></Button>, or style the Link",
    });
  }

  for (const match of text.matchAll(OPEN_NAME)) {
    checked += 1;
    const props = openingTagProps(text, match.index + match[0].length);
    if (
      HANDLER.test(props) || SUBMIT.test(props) ||
      AS_CHILD.test(props) || DISABLED.test(props)
    ) continue;
    // A Radix trigger wraps its child; look just behind for one.
    const before = text.slice(Math.max(0, match.index - 300), match.index);
    if (TRIGGERS.some((t) => before.includes(t))) continue;
    failures.push({
      kind: "dead",
      where: `${rel}:${lineOf(match.index)}`,
      detail: 'no onClick, no type="submit", no asChild and not disabled — this control does nothing',
    });
  }
}

if (failures.length > 0) {
  console.error(`\nInteractive control check failed: ${failures.length} problem(s).\n`);
  for (const f of failures) {
    console.error(`  [${f.kind}] ${f.where}\n          ${f.detail}`);
  }
  console.error("");
  process.exit(1);
}

console.log(
  `Interactive control check passed: ${checked} controls across the client source ` +
  `all have behaviour, and none nests a button inside a link.`,
);
