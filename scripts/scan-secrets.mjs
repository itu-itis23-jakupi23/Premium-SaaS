import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const maximumFileSize = 2 * 1024 * 1024;
const binaryExtensions = new Set([
  ".bin",
  ".dll",
  ".exe",
  ".glb",
  ".gltf",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".svgz",
  ".ttf",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const signatures = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g,
  ],
  ["OpenAI API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["Stripe live key", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
  ["Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{16,}\b/g],
  ["Resend API key", /\bre_[A-Za-z0-9_-]{24,}\b/g],
];

const protectedAssignment =
  /\b(AUTH_SECRET|MESSAGE_ENCRYPTION_KEY|RESEND_API_KEY|STRIPE_SECRET_KEY|DATABASE_URL)\b\s*[:=]\s*["']([^"'\r\n]+)["']/gi;
const safeFixtureValue =
  /(?:process\.env|\$\{|test|ci-|example|placeholder|change-me|not-for-production|localhost|127\.0\.0\.1)/i;

function gitFiles(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

const files = new Set([
  ...gitFiles(["ls-files"]),
  ...gitFiles(["ls-files", "--others", "--exclude-standard"]),
]);
const findings = [];

for (const relativePath of files) {
  const absolutePath = resolve(root, relativePath);
  if (binaryExtensions.has(extname(relativePath).toLowerCase())) continue;
  let metadata;
  try {
    metadata = statSync(absolutePath);
  } catch {
    continue;
  }
  if (!metadata.isFile() || metadata.size > maximumFileSize) continue;

  let contents;
  try {
    contents = readFileSync(absolutePath, "utf8");
  } catch {
    continue;
  }
  if (contents.includes("\0")) continue;

  for (const [label, pattern] of signatures) {
    pattern.lastIndex = 0;
    for (const match of contents.matchAll(pattern)) {
      const line = contents.slice(0, match.index).split("\n").length;
      findings.push(`${relativePath}:${line}: possible ${label}`);
    }
  }

  protectedAssignment.lastIndex = 0;
  for (const match of contents.matchAll(protectedAssignment)) {
    if (safeFixtureValue.test(match[2])) continue;
    const line = contents.slice(0, match.index).split("\n").length;
    findings.push(`${relativePath}:${line}: hard-coded ${match[1]}`);
  }
}

if (findings.length > 0) {
  console.error("Secret scan failed:\n");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  `Secret scan passed across ${files.size} tracked and untracked repository files.`,
);
