import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ENS_FURNITURE_ITEMS } from "./furniture-catalog";

/**
 * Every catalogue picture and model resolves to a file that is actually there.
 *
 * `catalogPreviewUrl` carries this note: deriving a preview path from the
 * model filename "meant every picture broke the moment a model was renamed or
 * repointed, silently and with no failing test". Storing the path on the item
 * fixed the deriving. It did not fix the silence - nothing checks that the
 * path points at anything, so a renamed file still breaks the catalogue with
 * every test green.
 *
 * The failure is quiet by design on both sides: a missing picture draws the
 * browser's broken-image icon inside an otherwise normal card, and a missing
 * model leaves the placeholder box that a legitimately un-modelled item also
 * shows. Neither looks like an error, so neither gets reported - someone just
 * quietly stops trusting the catalogue.
 *
 * These assets are served straight from `public/`, so existence on disk is
 * exactly what the browser will ask for.
 */

const publicDir = resolve(import.meta.dirname, "../../public");

/** Where the dev server and the build will look for a `/`-rooted asset. */
function servedPath(url: string): string {
  return resolve(publicDir, decodeURIComponent(url).replace(/^\/+/, ""));
}

describe("catalogue assets", () => {
  it("checks a catalogue big enough to be the real one", () => {
    // Guards the guard: an import that silently resolved to an empty list
    // would make every assertion below vacuously true.
    expect(ENS_FURNITURE_ITEMS.length).toBeGreaterThan(40);
  });

  it("ships the preview image every item points at", () => {
    const missing = ENS_FURNITURE_ITEMS
      .filter((item) => item.previewUrl)
      .filter((item) => !existsSync(servedPath(item.previewUrl!)))
      .map((item) => `${item.sku || item.id} -> ${item.previewUrl}`);

    expect(missing, `these previews are referenced but not shipped:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("ships the 3D model every item points at", () => {
    const missing = ENS_FURNITURE_ITEMS
      .filter((item) => item.modelUrl)
      .filter((item) => !existsSync(servedPath(item.modelUrl!)))
      .map((item) => `${item.sku || item.id} -> ${item.modelUrl}`);

    expect(missing, `these models are referenced but not shipped:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("gives every modelled item a picture to browse by", () => {
    // An item with a model but no preview falls back to a derived path that
    // may not exist, which is the arrangement the comment above warns about.
    const unpictured = ENS_FURNITURE_ITEMS
      .filter((item) => item.modelUrl && !item.previewUrl)
      .map((item) => item.sku || item.id);

    expect(
      unpictured.length,
      `these rely on a derived preview path rather than a stored one: ${unpictured.join(", ")}`,
    ).toBeLessThanOrEqual(1);
  });
});
