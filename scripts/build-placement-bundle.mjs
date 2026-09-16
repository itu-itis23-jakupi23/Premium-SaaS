/**
 * Compiles the placement rules for the booth renderer.
 *
 * workspace-geometry.ts is the single source for item/room/booth collision.
 * The React workspace imports it directly. The renderer cannot: booth-render.js
 * is a plain <script src> served verbatim out of public/, and it has to be a
 * classic script — the inline module beside it reaches back into its globals by
 * bare name (placedItemRenderXZ, mountedBaseY, syncCorrectedItemPosition), and
 * a classic script cannot use `import` at all. Module scripts are deferred, so
 * publishing the rules from the module half would also arrive too late: the
 * renderer builds its geometry during its own top-level execution.
 *
 * So the rules are compiled to a classic IIFE that assigns one global, loaded
 * immediately before the renderer. The output is committed, because public/ is
 * served verbatim and a missing artifact would be a blank booth rather than a
 * build error; `--check` fails when the committed copy has drifted from the
 * source, which is what CI runs.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landing = resolve(root, "artifacts", "ens-landing");
const entry = resolve(landing, "src", "pages", "pm", "workspace-geometry.ts");
const outfile = resolve(landing, "public", "workspace-placement.js");

// esbuild lives in the api-server workspace and is not hoisted to the root.
const require = createRequire(import.meta.url);
const esbuild = require(resolve(root, "artifacts", "api-server", "node_modules", "esbuild"));

const banner = [
  "// GENERATED — do not edit.",
  "// Source: artifacts/ens-landing/src/pages/pm/workspace-geometry.ts",
  "// Rebuild: node scripts/build-placement-bundle.mjs",
  "",
].join("\n");

const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: "iife",
  globalName: "ENSPlacement",
  platform: "browser",
  target: "es2020",
  write: false,
  banner: { js: banner },
  alias: { "@": resolve(landing, "src") },
});

const compiled = result.outputFiles[0].text;
const check = process.argv.includes("--check");

if (check) {
  const current = existsSync(outfile) ? readFileSync(outfile, "utf8") : "";
  if (current !== compiled) {
    console.error(
      "Placement bundle is stale.\n" +
      "  artifacts/ens-landing/public/workspace-placement.js no longer matches\n" +
      "  workspace-geometry.ts. Run: node scripts/build-placement-bundle.mjs",
    );
    process.exit(1);
  }
  console.log("Placement bundle check passed: the renderer's copy matches workspace-geometry.ts.");
} else {
  writeFileSync(outfile, compiled);
  console.log(`Placement bundle written: ${(compiled.length / 1024).toFixed(1)} KB`);
}
