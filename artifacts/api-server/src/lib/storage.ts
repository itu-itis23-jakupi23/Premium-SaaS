import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import path from "node:path";

export interface StoredFile {
  bucket: string;
  key: string;
  checksumSha256: string;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
  /** Resolved public URL, or null when download requires an authenticated route */
  publicUrl: string | null;
}

export interface StorageProvider {
  store(opts: {
    bytes: Buffer;
    organizationId: string;
    documentId: string;
    fileName: string;
    mimeType: string;
  }): Promise<StoredFile>;

  retrieve(bucket: string, key: string): Promise<Buffer>;
}

// ── Local-disk provider ──────────────────────────────────────────────────────

function documentRootDirectory(): string {
  return path.resolve(process.env.DOCUMENT_STORAGE_DIR ?? path.join(process.cwd(), "data", "documents"));
}

function localDocumentPath(organizationId: string, documentId: string, ext: string): string {
  return path.join(documentRootDirectory(), organizationId, `${documentId}${ext}`);
}

/**
 * The bucket this deployment is allowed to read from.
 *
 * `documents.storage_bucket` is passed to the provider on download, so without
 * this a row naming another bucket would send the API off to fetch it with
 * whatever credentials it holds.
 */
export function expectedStorageBucket(): string {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider === "local") return "local";
  return process.env.STORAGE_BUCKET ?? "";
}

/**
 * Whether a stored key is one this organization is allowed to read.
 *
 * `store()` always produces `<organizationId>/<documentId><ext>`, so a key that
 * does not start with the caller's own organization id was not produced for
 * them. Checked on the way in rather than on the way out, because an existing
 * row predating this check must still be readable.
 *
 * Separators are normalised because `store()` builds the key with `path.join`,
 * which emits a backslash on Windows and a forward slash elsewhere - the same
 * key is spelled differently depending on where it was written.
 */
export function isStorageKeyOwnedBy(key: string, organizationId: string): boolean {
  const normalized = key.split("\\").join("/");
  if (normalized.includes("..") || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return false;
  const [prefix, ...rest] = normalized.split("/");
  if (rest.length !== 1 || !rest[0]) return false;
  return prefix.toLowerCase() === organizationId.toLowerCase();
}

/**
 * Reject a path that escapes the document root.
 *
 * Defence in depth behind the key validation on the write side: this is the
 * last thing standing between a malformed `storage_key` and `readFile` of an
 * arbitrary file, and it holds whatever wrote that column. A traversal key
 * reached this point through the document-registration route, which accepted
 * `storageKey` straight from the request body, so any staff user could read
 * the API's own .env - database password, auth secret and provider keys - by
 * registering a document at "../../../.env" and downloading it.
 */
function resolveInsideRoot(root: string, key: string): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, key);
  const withSeparator = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  if (target !== resolvedRoot && !target.startsWith(withSeparator)) {
    throw new Error("Refusing to read outside the document storage directory");
  }
  return target;
}

const localDiskProvider: StorageProvider = {
  async store({ bytes, organizationId, documentId, fileName, mimeType }) {
    const ext = extname(fileName) || ".bin";
    const filePath = localDocumentPath(organizationId, documentId, ext);
    await mkdir(path.dirname(filePath), { recursive: true });

    const checksum = createHash("sha256").update(bytes).digest("hex");
    await writeFile(filePath, bytes);

    return {
      bucket: "local",
      key: path.join(organizationId, `${documentId}${ext}`),
      checksumSha256: checksum,
      sizeBytes: bytes.byteLength,
      mimeType,
      fileName,
      publicUrl: null,
    };
  },

  async retrieve(bucket, key) {
    if (bucket !== "local") throw new Error(`Cannot retrieve from bucket "${bucket}" with local provider`);
    return readFile(resolveInsideRoot(documentRootDirectory(), key));
  },
};

// ── S3-compatible provider ───────────────────────────────────────────────────
// Activated by STORAGE_PROVIDER=s3. Required env vars:
//   STORAGE_BUCKET         — bucket name
//   STORAGE_REGION         — AWS region (default: us-east-1)
//   STORAGE_ENDPOINT       — custom endpoint for S3-compatible stores (e.g. MinIO, R2)
//   STORAGE_ACCESS_KEY_ID  — AWS / provider access key
//   STORAGE_SECRET_ACCESS_KEY — AWS / provider secret key
//   STORAGE_URL_EXPIRY_SECONDS — presigned URL TTL (default: 3600)

function buildS3Provider(): StorageProvider {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET is required when STORAGE_PROVIDER=s3");

  const client = new S3Client({
    region: process.env.STORAGE_REGION ?? "us-east-1",
    ...(process.env.STORAGE_ENDPOINT ? { endpoint: process.env.STORAGE_ENDPOINT, forcePathStyle: true } : {}),
    ...(process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY
      ? { credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY } }
      : {}),
  });

  const urlExpiry = parseInt(process.env.STORAGE_URL_EXPIRY_SECONDS ?? "3600", 10);

  return {
    async store({ bytes, organizationId, documentId, fileName, mimeType }) {
      const ext = extname(fileName) || ".bin";
      const key = `${organizationId}/${documentId}${ext}`;
      const checksum = createHash("sha256").update(bytes).digest("hex");

      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
        ContentLength: bytes.byteLength,
        Metadata: { originalName: encodeURIComponent(fileName), sha256: checksum },
      }));

      const publicUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: urlExpiry });

      return { bucket, key, checksumSha256: checksum, sizeBytes: bytes.byteLength, mimeType, fileName, publicUrl };
    },

    async retrieve(storedBucket, key) {
      // The bucket comes from the document row, not from configuration, so a
      // crafted row would otherwise point the API at any bucket these
      // credentials can reach.
      if (storedBucket !== bucket) {
        throw new Error(`Refusing to read from bucket "${storedBucket}"; this deployment serves "${bucket}"`);
      }
      const resp = await client.send(new GetObjectCommand({ Bucket: storedBucket, Key: key }));
      if (!resp.Body) throw new Error(`S3 returned empty body for key "${key}"`);
      const chunks: Buffer[] = [];
      for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    },
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider === "local") return localDiskProvider;
  if (provider === "s3") return buildS3Provider();
  throw new Error(`Unknown STORAGE_PROVIDER: "${provider}". Supported: "local", "s3"`);
}
