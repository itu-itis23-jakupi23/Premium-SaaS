import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canPreviewInline, getDocumentDownloadUrl, getDocumentPreviewUrl } from "./platform-api";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "..");

/** The server's own whitelist, read from source rather than restated here. */
function serverInlineTypes(): string[] {
  const source = readFileSync(
    resolve(repoRoot, "artifacts", "api-server", "src", "routes", "documents.ts"),
    "utf8",
  );
  const block = source.match(/const INLINE_VIEWABLE_TYPES = new Set\(\[([\s\S]*?)\]\)/);
  expect(block, "could not find INLINE_VIEWABLE_TYPES in the documents route").toBeTruthy();
  return [...block![1].matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
}

/**
 * Inline document preview, and the whitelist that makes it safe.
 *
 * The client portal's preview pane was a placeholder reading "Image preview
 * not available in demo" for every file, because the download route always
 * sent `Content-Disposition: attachment` - nothing a browser will render in an
 * <img> or an <iframe>. It now asks for `?inline=1`, which the server honours
 * only for types that cannot carry script.
 *
 * Two independent copies of that list therefore exist, one per side of the
 * wire, and they have different failure modes if they drift: a type the client
 * thinks is viewable but the server does not shows an empty frame, and one the
 * server would serve but the client does not offer is a feature quietly lost.
 * Neither shows up in a typecheck, so it is pinned here.
 */
describe("inline preview whitelist", () => {
  it("matches the server's list exactly", () => {
    const client = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"].sort();

    // Guards the guard: a renamed constant would make this vacuous.
    expect(serverInlineTypes().length).toBeGreaterThan(0);
    expect(serverInlineTypes()).toEqual(client);
    for (const type of client) {
      expect(canPreviewInline(type), type).toBe(true);
    }
  });

  it("excludes the formats that can carry script", () => {
    // SVG is the one that catches people out: it is an image, and it can hold
    // a <script> element. Serving it inline from the API origin would be
    // stored XSS against any cookie scoped there.
    for (const type of [
      "image/svg+xml",
      "text/html",
      "application/xhtml+xml",
      "text/xml",
      "application/xml",
      "text/javascript",
      "application/javascript",
    ]) {
      expect(canPreviewInline(type), type).toBe(false);
      expect(serverInlineTypes(), type).not.toContain(type);
    }
  });

  it("does not offer a viewer for ordinary office and archive files", () => {
    for (const type of [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/zip",
      "text/csv",
      "application/octet-stream",
    ]) {
      expect(canPreviewInline(type), type).toBe(false);
    }
  });

  it("tolerates the casing and padding a stored mime type arrives with", () => {
    // `mime_type` is whatever was recorded at upload, so it is not guaranteed
    // to be lowercase or trimmed.
    expect(canPreviewInline("Application/PDF")).toBe(true);
    expect(canPreviewInline("  image/png  ")).toBe(true);
    expect(canPreviewInline("")).toBe(false);
  });
});

describe("document urls", () => {
  it("asks for the inline form with a flag the server reads", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    expect(getDocumentPreviewUrl(id)).toBe(`${getDocumentDownloadUrl(id)}?inline=1`);
  });

  it("keeps the download url free of the inline flag", () => {
    // A download must stay an attachment; adding the flag here would make
    // every "Download" open in a tab instead of saving.
    expect(getDocumentDownloadUrl("abc")).not.toContain("inline");
  });
});
