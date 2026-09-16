/**
 * Icon / builtin name-collision gate.
 *
 * lucide-react exports icons whose names are also JavaScript or DOM globals:
 * `Map`, `Image`, `File`, `Text`, `Option`, `History` and others. Importing one
 * of those bare shadows the global for the whole module, and the failure is
 * silent — `new Map()` returns a React component rather than throwing, so the
 * code type-checks, renders, and quietly does the wrong thing. That is exactly
 * what happened in PMWorkspace.tsx, where `new Map(...)` resolved to the icon
 * and the fix at the time was to avoid `Map` altogether.
 *
 * A bare import is only a problem when the file also uses the global it hides,
 * so this reports two levels:
 *
 *   COLLISION  - shadowed *and* the global is used in the same file. Fails.
 *   shadowed   - shadowed but the global is never used here. Reported, not
 *                failed: it is latent, and failing on it would mean renaming
 *                every `Menu`, `Link` and `Table` icon in the app for no
 *                present defect.
 *
 * Aliased imports (`Map as MapIcon`) are clean and are not reported.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Globals worth guarding: constructible or commonly called as a value. */
const GLOBALS = new Set([
  "Map", "Set", "WeakMap", "WeakSet", "Image", "Text", "Option", "Range",
  "History", "Location", "Navigator", "Screen", "Audio", "Notification",
  "Event", "Element", "Headers", "Request", "Response", "Worker", "Blob",
  "File", "FileList", "Path2D", "Table", "Document", "Node", "Symbol",
  "Promise", "Proxy", "Reflect", "Number", "String", "Boolean", "Array",
  "Object", "Function", "Date", "RegExp", "Error", "Math", "JSON", "Comment",
  "Selection", "Frame", "Menu", "Link",
]);

const roots = ["artifacts/ens-landing/src", "artifacts/api-server/src", "lib"];
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "dist") walk(full);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
}
for (const dir of roots) {
  const full = resolve(root, dir);
  if (existsSync(full)) walk(full);
}

const collisions = [];
const shadowed = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const block = source.match(/import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["']/);
  if (!block) continue;
  const specifiers = block[1]
    .split(",")
    .map((entry) => entry.replace(/\/\/.*$/gm, "").trim())
    .filter(Boolean);

  for (const specifier of specifiers) {
    const [imported, alias] = specifier.split(/\s+as\s+/).map((part) => part.trim());
    if (alias) continue;              // `Map as MapIcon` hides nothing
    if (!GLOBALS.has(imported)) continue;

    // Does the file use the global it has just hidden?
    const patterns = [
      new RegExp(String.raw`new\s+${imported}\s*\(`),
      new RegExp(String.raw`\b${imported}\s*\.\s*(from|of|prototype|isArray|keys|entries|values|parse|stringify)\b`),
      new RegExp(String.raw`instanceof\s+${imported}\b`),
    ];
    const where = relative(root, file).replace(/\\/g, "/");
    if (patterns.some((pattern) => pattern.test(source))) collisions.push({ imported, where });
    else shadowed.push({ imported, where });
  }
}

for (const entry of shadowed) {
  console.log(`  shadowed   ${entry.imported.padEnd(10)} ${entry.where}`);
}

if (collisions.length) {
  console.error("Icon shadowing check failed — a lucide-react icon is hiding a global this file uses:");
  for (const entry of collisions) {
    console.error(`  - ${entry.where} imports \`${entry.imported}\` bare and also uses the \`${entry.imported}\` global.`);
    console.error(`    Alias it: import { ${entry.imported} as ${entry.imported}Icon } from "lucide-react"`);
  }
  process.exit(1);
}

console.log(
  `Icon shadowing check passed: ${files.length} files scanned, ` +
  `${shadowed.length} latent shadow(s), no icon hides a global its file uses.`,
);
