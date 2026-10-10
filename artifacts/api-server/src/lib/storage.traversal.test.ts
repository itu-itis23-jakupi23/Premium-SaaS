import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expectedStorageBucket, getStorageProvider, isStorageKeyOwnedBy } from "./storage";

/**
 * Path containment on document retrieval.
 *
 * This covers a real authenticated arbitrary file read. The document
 * registration route accepted `storageBucket` and `storageKey` straight from
 * the request body, stored them verbatim, and the download route passed them
 * to the provider, which did `path.join(documentRoot, key)` and `readFile`.
 * Any chief or PM could register a document at `../../../.env` and download
 * the API's own environment file - database password, auth secret, mail and
 * payment keys - which in a shared deployment is every tenant's data.
 *
 * Two layers now stand in the way, and both are checked here: the route
 * refuses a key that is not prefixed with the caller's organization, and the
 * provider refuses to resolve outside its root whatever is in the column.
 */
describe("local storage retrieval containment", () => {
  let root: string;
  let previousDir: string | undefined;
  let previousProvider: string | undefined;
  const organizationId = "11111111-2222-3333-4444-555555555555";

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "ens-storage-"));
    previousDir = process.env.DOCUMENT_STORAGE_DIR;
    previousProvider = process.env.STORAGE_PROVIDER;
    process.env.DOCUMENT_STORAGE_DIR = path.join(root, "documents");
    process.env.STORAGE_PROVIDER = "local";
    await mkdir(path.join(root, "documents", organizationId), { recursive: true });
    // The file a traversal would be reaching for, one level above the root.
    await writeFile(path.join(root, "secrets.env"), "AUTH_SECRET=super-secret\n");
  });

  afterEach(async () => {
    if (previousDir === undefined) delete process.env.DOCUMENT_STORAGE_DIR;
    else process.env.DOCUMENT_STORAGE_DIR = previousDir;
    if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = previousProvider;
    await rm(root, { recursive: true, force: true });
  });

  it("reads back a file it stored itself", async () => {
    // The control: containment must not break the normal path.
    const provider = getStorageProvider();
    const documentId = randomUUID();
    const stored = await provider.store({
      bytes: Buffer.from("drawing bytes"),
      organizationId,
      documentId,
      fileName: "plan.pdf",
      mimeType: "application/pdf",
    });
    const bytes = await provider.retrieve(stored.bucket, stored.key);
    expect(bytes.toString()).toBe("drawing bytes");
  });

  it("refuses a key that climbs out of the document root", async () => {
    const provider = getStorageProvider();
    for (const key of [
      "../secrets.env",
      "../../secrets.env",
      `${organizationId}/../../secrets.env`,
      "..\\secrets.env",
    ]) {
      /**
       * Asserted on the returned bytes, not only on "it threw".
       *
       * A missing-file ENOENT is also a rejection, so a bare
       * `rejects.toThrow()` can pass for the wrong reason the moment a path
       * happens not to exist — and then reports a confusing ENOENT when the
       * real answer is "this read should never have been attempted". What
       * matters is that the file outside the root never comes back.
       */
      let returned: string | null = null;
      let failure: Error | null = null;
      try {
        returned = (await provider.retrieve("local", key)).toString();
      } catch (reason) {
        failure = reason as Error;
      }
      expect(returned, `${key} returned file contents from outside the root`).toBeNull();
      expect(failure?.message, `${key} was rejected, but not by the containment check`)
        .toMatch(/outside the document storage/i);
    }
  });

  it("refuses an absolute path", async () => {
    const provider = getStorageProvider();
    const absolute = path.join(root, "secrets.env");
    // path.resolve discards the root entirely for an absolute second argument,
    // which is exactly how this class of bug hides.
    let returned: string | null = null;
    let failure: Error | null = null;
    try {
      returned = (await provider.retrieve("local", absolute)).toString();
    } catch (reason) {
      failure = reason as Error;
    }
    expect(returned, "an absolute key returned file contents").toBeNull();
    expect(failure?.message).toMatch(/outside the document storage/i);
  });

  it("refuses a bucket this deployment does not serve", async () => {
    const provider = getStorageProvider();
    await expect(provider.retrieve("some-other-bucket", "a/b")).rejects.toThrow();
  });
});

describe("isStorageKeyOwnedBy", () => {
  const org = "11111111-2222-3333-4444-555555555555";
  const other = "99999999-8888-7777-6666-555555555555";

  it("accepts the shape store() produces", () => {
    expect(isStorageKeyOwnedBy(`${org}/${randomUUID()}.pdf`, org)).toBe(true);
    // store() uses path.join, which emits a backslash on Windows, so the same
    // key is spelled differently depending on where it was written.
    expect(isStorageKeyOwnedBy(`${org}\\${randomUUID()}.pdf`, org)).toBe(true);
  });

  it("is case-insensitive on the organization id", () => {
    expect(isStorageKeyOwnedBy(`${org.toUpperCase()}/${randomUUID()}.pdf`, org)).toBe(true);
  });

  it("rejects another organization's prefix", () => {
    // Cross-tenant registration: pointing a row at someone else's object.
    expect(isStorageKeyOwnedBy(`${other}/${randomUUID()}.pdf`, org)).toBe(false);
  });

  it("rejects every traversal spelling", () => {
    for (const key of [
      "../.env",
      "..\\.env",
      `${org}/../../.env`,
      `${org}\\..\\..\\.env`,
      "/etc/passwd",
      "C:\\Windows\\win.ini",
      ".env",
    ]) {
      expect(isStorageKeyOwnedBy(key, org), key).toBe(false);
    }
  });

  it("rejects a nested key, which store() never produces", () => {
    // Exactly one path segment after the prefix. Anything deeper did not come
    // from store() and should not be trusted to have come from anywhere safe.
    expect(isStorageKeyOwnedBy(`${org}/nested/file.pdf`, org)).toBe(false);
    expect(isStorageKeyOwnedBy(org, org)).toBe(false);
    expect(isStorageKeyOwnedBy(`${org}/`, org)).toBe(false);
  });
});

describe("expectedStorageBucket", () => {
  it("is 'local' for the local provider", () => {
    const previous = process.env.STORAGE_PROVIDER;
    process.env.STORAGE_PROVIDER = "local";
    expect(expectedStorageBucket()).toBe("local");
    if (previous === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = previous;
  });

  it("is the configured bucket for s3", () => {
    const previousProvider = process.env.STORAGE_PROVIDER;
    const previousBucket = process.env.STORAGE_BUCKET;
    process.env.STORAGE_PROVIDER = "s3";
    process.env.STORAGE_BUCKET = "ens-documents";
    expect(expectedStorageBucket()).toBe("ens-documents");
    if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = previousProvider;
    if (previousBucket === undefined) delete process.env.STORAGE_BUCKET;
    else process.env.STORAGE_BUCKET = previousBucket;
  });
});
