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
    const filePath = path.join(documentRootDirectory(), key);
    return readFile(filePath);
  },
};

// ── Factory ──────────────────────────────────────────────────────────────────
// Extend this to return an S3Provider when STORAGE_PROVIDER=s3 is set.
// The S3Provider would use STORAGE_BUCKET, STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID,
// and STORAGE_SECRET_ACCESS_KEY env vars — swappable without changing call sites.

export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider === "local") return localDiskProvider;
  throw new Error(`Unknown STORAGE_PROVIDER: "${provider}". Supported: "local"`);
}
