import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landingRoot = resolve(root, "artifacts", "ens-landing");
const indexPath = resolve(landingRoot, "index.html");
const html = readFileSync(indexPath, "utf8");

function fail(message) {
  console.error(`Public metadata check failed: ${message}`);
  process.exitCode = 1;
}

function getMetaContent(attribute, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const expected = value.toLowerCase();

  for (const tag of tags) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(
        ([, name, , content]) => [name.toLowerCase(), content],
      ),
    );

    if (attributes[attribute]?.toLowerCase() === expected) {
      return attributes.content;
    }
  }

  return undefined;
}

const viewport = getMetaContent("name", "viewport");
if (!viewport) {
  fail("the viewport meta tag is missing");
} else if (/maximum-scale\s*=|user-scalable\s*=\s*no/i.test(viewport)) {
  fail("the viewport disables browser zoom");
}

const ogImage = getMetaContent("property", "og:image");
const twitterImage = getMetaContent("name", "twitter:image");

if (!ogImage) fail("og:image is missing");
if (!twitterImage) fail("twitter:image is missing");
if (ogImage && twitterImage && ogImage !== twitterImage) {
  fail("og:image and twitter:image must reference the same preview asset");
}

if (ogImage) {
  if (!ogImage.startsWith("/") || ogImage.startsWith("//")) {
    fail("the preview image must use a root-relative public asset path");
  } else {
    const assetPath = resolve(landingRoot, "public", ogImage.slice(1));
    if (!existsSync(assetPath)) {
      fail(`the preview image does not exist: ${assetPath}`);
    }
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log("Public metadata check passed: zoom is enabled and social images resolve.");
