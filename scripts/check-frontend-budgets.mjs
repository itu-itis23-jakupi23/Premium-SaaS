import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = resolve(root, "artifacts/ens-landing");
const evidenceDirectory = resolve(root, ".release-evidence");
const evidencePath = resolve(evidenceDirectory, "frontend-performance.json");

const budgets = {
  initialJavaScript: {
    rawBytes: 800 * 1024,
    gzipBytes: 250 * 1024,
  },
  initialStylesheets: {
    rawBytes: 220 * 1024,
    gzipBytes: 35 * 1024,
  },
  largestJavaScriptChunk: {
    rawBytes: 640 * 1024,
    gzipBytes: 170 * 1024,
  },
  largestDeployedAsset: {
    rawBytes: 3 * 1024 * 1024,
  },
};

/**
 * Marketing entry budget (CS-14).
 *
 * The client portal serves the public landing page at "/", so an anonymous
 * prospect on a phone pays this cost before reading a single word. The general
 * `initialJavaScript` budget is sized for an authenticated application view and
 * is too loose to catch marketing-page creep.
 *
 * This is a ratchet: set just above the current measurement so any regression
 * fails the release gate. Lower it when the number improves; never raise it to
 * make a build pass.
 */
const MARKETING_PORTAL = "client";
const marketingBudget = {
  initialJavaScriptGzipBytes: 220 * 1024,
  initialStylesheetGzipBytes: 30 * 1024,
};

const forbiddenInitialChunks = [/vendor-charts/i, /vendor-three/i];
const failures = [];
const portals = ["staff", "client"].map(measurePortal);

const report = {
  schemaVersion: 1,
  measuredAt: new Date().toISOString(),
  budgets,
  forbiddenInitialChunks: forbiddenInitialChunks.map(
    (pattern) => pattern.source,
  ),
  portals,
  status: failures.length === 0 ? "passed" : "failed",
  failures,
};

mkdirSync(evidenceDirectory, { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

for (const portal of portals) {
  console.log(`\n${portal.name} frontend budget`);
  console.log(
    `  initial JS: ${formatBytes(portal.initialJavaScript.rawBytes)} raw / ${formatBytes(portal.initialJavaScript.gzipBytes)} gzip`,
  );
  console.log(
    `  initial CSS: ${formatBytes(portal.initialStylesheets.rawBytes)} raw / ${formatBytes(portal.initialStylesheets.gzipBytes)} gzip`,
  );
  console.log(
    `  largest JS: ${portal.largestJavaScriptChunk.path} (${formatBytes(portal.largestJavaScriptChunk.rawBytes)} raw / ${formatBytes(portal.largestJavaScriptChunk.gzipBytes)} gzip)`,
  );
  console.log(
    `  largest asset: ${portal.largestDeployedAsset.path} (${formatBytes(portal.largestDeployedAsset.rawBytes)})`,
  );
}

if (failures.length > 0) {
  console.error("\nFrontend performance budget failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`Evidence: ${evidencePath}`);
  process.exit(1);
}

console.log(`\nFrontend performance budgets passed. Evidence: ${evidencePath}`);

function measurePortal(name) {
  const distRoot = resolve(frontendRoot, "dist", name);
  const indexPath = resolve(distRoot, "index.html");

  if (!existsSync(indexPath)) {
    failures.push(`${name}: missing build output ${relative(root, indexPath)}`);
    return emptyPortal(name);
  }

  const html = readFileSync(indexPath, "utf8");
  const moduleScripts = extractTagReferences(
    html,
    "script",
    "src",
    (attributes) => /\btype=["']module["']/i.test(attributes),
  );
  const modulePreloads = extractTagReferences(
    html,
    "link",
    "href",
    (attributes) => /\brel=["']modulepreload["']/i.test(attributes),
  );
  const stylesheets = extractTagReferences(html, "link", "href", (attributes) =>
    /\brel=["']stylesheet["']/i.test(attributes),
  );
  const initialJavaScriptPaths = unique([
    ...moduleScripts,
    ...modulePreloads,
  ]).filter((path) => path.endsWith(".js"));

  for (const path of initialJavaScriptPaths) {
    if (forbiddenInitialChunks.some((pattern) => pattern.test(path))) {
      failures.push(
        `${name}: lazy-only chunk is preloaded by index.html: ${path}`,
      );
    }
  }

  const initialJavaScript = totalMeasurements(
    initialJavaScriptPaths.map((path) =>
      measureReference(distRoot, path, name),
    ),
  );
  const initialStylesheets = totalMeasurements(
    stylesheets.map((path) => measureReference(distRoot, path, name)),
  );
  const files = listFiles(distRoot);
  const javaScriptFiles = files.filter((path) => path.endsWith(".js"));
  const largestJavaScriptChunk = largestMeasurement(
    javaScriptFiles.map((path) => measureFile(distRoot, path)),
  );
  const largestDeployedAsset = largestMeasurement(
    files.map((path) => measureFile(distRoot, path)),
  );

  enforceLimit(
    `${name}: initial JavaScript raw`,
    initialJavaScript.rawBytes,
    budgets.initialJavaScript.rawBytes,
  );
  enforceLimit(
    `${name}: initial JavaScript gzip`,
    initialJavaScript.gzipBytes,
    budgets.initialJavaScript.gzipBytes,
  );
  if (name === MARKETING_PORTAL) {
    enforceLimit(
      `${name}: marketing entry JavaScript gzip (CS-14)`,
      initialJavaScript.gzipBytes,
      marketingBudget.initialJavaScriptGzipBytes,
    );
    enforceLimit(
      `${name}: marketing entry stylesheet gzip (CS-14)`,
      initialStylesheets.gzipBytes,
      marketingBudget.initialStylesheetGzipBytes,
    );
  }

  enforceLimit(
    `${name}: initial stylesheet raw`,
    initialStylesheets.rawBytes,
    budgets.initialStylesheets.rawBytes,
  );
  enforceLimit(
    `${name}: initial stylesheet gzip`,
    initialStylesheets.gzipBytes,
    budgets.initialStylesheets.gzipBytes,
  );
  enforceLimit(
    `${name}: largest JavaScript chunk raw`,
    largestJavaScriptChunk.rawBytes,
    budgets.largestJavaScriptChunk.rawBytes,
  );
  enforceLimit(
    `${name}: largest JavaScript chunk gzip`,
    largestJavaScriptChunk.gzipBytes,
    budgets.largestJavaScriptChunk.gzipBytes,
  );
  enforceLimit(
    `${name}: largest deployed asset`,
    largestDeployedAsset.rawBytes,
    budgets.largestDeployedAsset.rawBytes,
  );

  return {
    name,
    initialJavaScript: {
      paths: initialJavaScriptPaths,
      ...initialJavaScript,
    },
    initialStylesheets: {
      paths: stylesheets,
      ...initialStylesheets,
    },
    largestJavaScriptChunk,
    largestDeployedAsset,
  };
}

function extractTagReferences(html, tagName, attributeName, predicate) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
  const references = [];

  for (const tag of tags) {
    if (!predicate(tag)) continue;
    const match = tag.match(
      new RegExp(`\\b${attributeName}=["']([^"']+)["']`, "i"),
    );
    if (match) references.push(normalizeReference(match[1]));
  }

  return references;
}

function normalizeReference(reference) {
  const clean = decodeURIComponent(reference.split(/[?#]/, 1)[0]).replace(
    /\\/g,
    "/",
  );
  const assetIndex = clean.lastIndexOf("/assets/");
  if (assetIndex !== -1) return clean.slice(assetIndex + 1);
  return clean.replace(/^\/+/, "");
}

function measureReference(distRoot, path, portalName) {
  const absolutePath = resolve(distRoot, path);
  const expectedPrefix = `${distRoot}${sep}`;
  if (!absolutePath.startsWith(expectedPrefix) || !existsSync(absolutePath)) {
    failures.push(
      `${portalName}: index.html references missing output ${path}`,
    );
    return { path, rawBytes: 0, gzipBytes: 0 };
  }
  return measureFile(distRoot, path);
}

function measureFile(distRoot, path) {
  const absolutePath = resolve(distRoot, path);
  const content = readFileSync(absolutePath);
  return {
    path: path.replace(/\\/g, "/"),
    rawBytes: content.length,
    gzipBytes: gzipSync(content, { level: 9 }).length,
  };
}

function listFiles(directory, current = directory) {
  return readdirSync(current).flatMap((entry) => {
    const absolutePath = join(current, entry);
    return statSync(absolutePath).isDirectory()
      ? listFiles(directory, absolutePath)
      : [relative(directory, absolutePath)];
  });
}

function totalMeasurements(measurements) {
  return measurements.reduce(
    (total, measurement) => ({
      rawBytes: total.rawBytes + measurement.rawBytes,
      gzipBytes: total.gzipBytes + measurement.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 },
  );
}

function largestMeasurement(measurements) {
  return measurements.reduce(
    (largest, measurement) =>
      measurement.rawBytes > largest.rawBytes ? measurement : largest,
    { path: "none", rawBytes: 0, gzipBytes: 0 },
  );
}

function enforceLimit(label, actual, limit) {
  if (actual > limit) {
    failures.push(
      `${label} is ${formatBytes(actual)}; budget is ${formatBytes(limit)}`,
    );
  }
}

function unique(values) {
  return [...new Set(values)];
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function emptyPortal(name) {
  return {
    name,
    initialJavaScript: { paths: [], rawBytes: 0, gzipBytes: 0 },
    initialStylesheets: { paths: [], rawBytes: 0, gzipBytes: 0 },
    largestJavaScriptChunk: { path: "none", rawBytes: 0, gzipBytes: 0 },
    largestDeployedAsset: { path: "none", rawBytes: 0, gzipBytes: 0 },
  };
}
