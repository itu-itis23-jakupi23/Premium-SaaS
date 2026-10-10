import { sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { db } from "@workspace/db";
import { requireAuth, requireRoles, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { expectedStorageBucket, getStorageProvider, isStorageKeyOwnedBy } from "../lib/storage";

const router: IRouter = Router();

router.use("/platform/documents", requireAuth, requireTenant);

// ── Visibility helpers ───────────────────────────────────────────────────────

type Visibility = "internal" | "client_visible" | "public_link";

function visibilitySql(auth: AuthContext) {
  const canSeeInternal = auth.user.role === "admin" || auth.user.role === "owner" ||
    auth.user.role === "chief" || auth.user.role === "pm";
  if (canSeeInternal) {
    return sql`true`;
  }
  // client role: can only see client_visible and public_link documents
  return sql`d.visibility::text in ('client_visible', 'public_link')`;
}

function isValidVisibility(v: unknown): v is Visibility {
  return v === "internal" || v === "client_visible" || v === "public_link";
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function stringValue(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function queryRows<T>(statement: ReturnType<typeof sql>) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

// ── Document row shape returned to callers ──────────────────────────────────

interface DocumentRow {
  id: string;
  projectId: string | null;
  clientId: string | null;
  kind: string;
  visibility: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storageKey: string;
  uploadedBy: string | null;
  uploadedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
}

async function getDocuments(
  organizationId: string,
  auth: AuthContext,
  filter: { projectId?: string | null; clientId?: string | null; limit?: number; offset?: number },
): Promise<DocumentRow[]> {
  const conditions = [
    sql`d.organization_id = ${organizationId}::uuid`,
    sql`d.deleted_at is null`,
    visibilitySql(auth),
  ];

  if (filter.projectId) {
    conditions.push(sql`d.project_id = ${filter.projectId}::uuid`);
    // PM scope: only see documents for projects they are assigned to
    if (auth.user.role === "pm") {
      conditions.push(sql`exists (
        select 1 from projects p
        where p.id = d.project_id
          and p.organization_id = ${organizationId}::uuid
          and (p.assigned_pm_user_id = ${auth.user.id}::uuid or exists (
            select 1 from project_members pm
            where pm.project_id = p.id and pm.user_id = ${auth.user.id}::uuid
          ))
      )`);
    }
  } else if (filter.clientId) {
    conditions.push(sql`d.client_id = ${filter.clientId}::uuid`);
  }

  const whereSql = sql.join(conditions, sql` and `);
  const limit = Math.min(100, Math.max(1, filter.limit ?? 50));
  const offset = Math.max(0, filter.offset ?? 0);

  return queryRows<DocumentRow>(sql`
    select
      d.id::text,
      d.project_id::text as "projectId",
      d.client_id::text as "clientId",
      d.kind::text,
      d.visibility::text,
      d.file_name as "fileName",
      d.mime_type as "mimeType",
      d.size_bytes as "sizeBytes",
      d.storage_bucket as "storageBucket",
      d.storage_key as "storageKey",
      uploader.name as "uploadedBy",
      d.uploaded_by_user_id::text as "uploadedByUserId",
      d.approved_at::text as "approvedAt",
      d.created_at::text as "createdAt"
    from documents d
    left join users uploader on uploader.id = d.uploaded_by_user_id
    where ${whereSql}
    order by d.created_at desc
    limit ${limit} offset ${offset}
  `);
}

// ── Routes ──────────────────────────────────────────────────────────────────

router.get("/platform/documents", async (req, res) => {
  const organization = req.tenant!;
  const auth = req.auth!;
  const projectId = stringValue(req.query.projectId);
  const clientId = stringValue(req.query.clientId);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  if (projectId && !isUuid(projectId)) {
    res.status(400).json({ error: "A valid projectId is required" });
    return;
  }
  if (clientId && !isUuid(clientId)) {
    res.status(400).json({ error: "A valid clientId is required" });
    return;
  }

  const documents = await getDocuments(organization.id, auth, { projectId, clientId, limit, offset });
  res.json({ documents, pagination: { limit, offset, count: documents.length } });
});

router.post("/platform/documents", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  const organization = req.tenant!;
  const auth = req.auth!;
  const data = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};

  const projectId = stringValue(data.projectId);
  const clientId = stringValue(data.clientId);
  const kind = (stringValue(data.kind) ?? "other").slice(0, 60);
  const visibility = stringValue(data.visibility) ?? "internal";
  const fileName = stringValue(data.fileName)?.slice(0, 255);
  const mimeType = normalizeMimeType(stringValue(data.mimeType));
  const sizeBytes = Number(data.sizeBytes) || 0;
  const storageBucket = stringValue(data.storageBucket);
  const storageKey = stringValue(data.storageKey);

  if (!fileName) {
    res.status(400).json({ error: "fileName is required" });
    return;
  }
  if (!storageBucket || !storageKey) {
    res.status(400).json({ error: "storageBucket and storageKey are required" });
    return;
  }
  /**
   * The storage location is caller-supplied here, and it is handed straight to
   * the storage provider on download. Unchecked, that was an authenticated
   * arbitrary file read: registering a document at
   * `{"storageBucket":"local","storageKey":"../../../.env"}` and downloading it
   * returned the API's own environment file - database password, auth secret,
   * mail and payment keys - to any chief or PM. The org prefix also stops one
   * organization registering a pointer at another's object.
   */
  if (storageBucket !== expectedStorageBucket()) {
    res.status(400).json({ error: "storageBucket is not the bucket this deployment serves" });
    return;
  }
  if (!isStorageKeyOwnedBy(storageKey, organization.id)) {
    res.status(400).json({
      error: "storageKey must be an object stored for this organization, as \"<organizationId>/<file>\"",
    });
    return;
  }
  if (projectId && !isUuid(projectId)) {
    res.status(400).json({ error: "A valid projectId is required" });
    return;
  }
  if (clientId && !isUuid(clientId)) {
    res.status(400).json({ error: "A valid clientId is required" });
    return;
  }
  if (!isValidVisibility(visibility)) {
    res.status(400).json({ error: "visibility must be internal, client_visible, or public_link" });
    return;
  }

  const rows = await queryRows<{ id: string }>(sql`
    insert into documents (
      organization_id,
      project_id,
      client_id,
      uploaded_by_user_id,
      kind,
      visibility,
      file_name,
      mime_type,
      size_bytes,
      storage_bucket,
      storage_key
    ) values (
      ${organization.id}::uuid,
      ${projectId}::uuid,
      ${clientId}::uuid,
      ${auth.user.id}::uuid,
      ${kind}::document_kind,
      ${visibility}::file_visibility,
      ${fileName},
      ${mimeType},
      ${sizeBytes},
      ${storageBucket},
      ${storageKey}
    )
    returning id::text
  `);

  const id = rows[0]?.id;
  if (!id) throw new Error("Document insert did not return an id");

  await db.execute(sql`
    insert into activity_events (organization_id, actor_user_id, event_type, message, metadata)
    values (
      ${organization.id}::uuid,
      ${auth.user.id}::uuid,
      'file_uploaded',
      ${`uploaded ${fileName}`},
      ${JSON.stringify({ documentId: id, kind, visibility, projectId: projectId ?? null, clientId: clientId ?? null })}::jsonb
    )
  `);

  const documents = await getDocuments(organization.id, auth, { projectId, clientId });
  res.status(201).json({ ok: true, documentId: id, documents });
});

router.patch("/platform/documents/:documentId/visibility", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  const organization = req.tenant!;
  const documentId = stringValue(req.params.documentId);

  if (!documentId || !isUuid(documentId)) {
    res.status(400).json({ error: "A valid document id is required" });
    return;
  }

  const visibility = stringValue((req.body as Record<string, unknown>)?.visibility);
  if (!isValidVisibility(visibility)) {
    res.status(400).json({ error: "visibility must be internal, client_visible, or public_link" });
    return;
  }

  const rows = await queryRows<{ id: string; projectId: string | null }>(sql`
    update documents
    set visibility = ${visibility}::file_visibility
    where id = ${documentId}::uuid
      and organization_id = ${organization.id}::uuid
      and deleted_at is null
    returning id::text, project_id::text as "projectId"
  `);

  if (!rows[0]) {
    res.status(404).json({ error: "Document was not found" });
    return;
  }

  const documents = await getDocuments(organization.id, req.auth!, { projectId: rows[0].projectId });
  res.json({ ok: true, documents });
});

router.delete("/platform/documents/:documentId", requireRoles(["admin", "owner", "chief", "pm"]), async (req, res) => {
  const organization = req.tenant!;
  const documentId = stringValue(req.params.documentId);

  if (!documentId || !isUuid(documentId)) {
    res.status(400).json({ error: "A valid document id is required" });
    return;
  }

  const rows = await queryRows<{ id: string }>(sql`
    update documents
    set deleted_at = now()
    where id = ${documentId}::uuid
      and organization_id = ${organization.id}::uuid
      and deleted_at is null
    returning id::text
  `);

  if (!rows[0]) {
    res.status(404).json({ error: "Document was not found" });
    return;
  }

  res.json({ ok: true });
});

// ── File upload ──────────────────────────────────────────────────────────────
// Accepts raw binary body with metadata in request headers. Stores the file via
// the configured StorageProvider (local disk by default, S3 when STORAGE_PROVIDER=s3)
// and creates the document record in one step.

router.post(
  "/platform/documents/upload",
  requireRoles(["admin", "owner", "chief", "pm"]),
  express.raw({ type: "*/*", limit: "50mb" }),
  async (req: Request, res: Response) => {
    const organization = req.tenant!;
    const auth = req.auth!;
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (!bytes.length) {
      res.status(400).json({ error: "Request body must contain the file bytes" });
      return;
    }

    const fileName = (stringValue(req.headers["x-file-name"] as string) ?? "upload.bin").slice(0, 255);
    const mimeType = normalizeMimeType(
      stringValue(req.headers["x-content-type"] as string) ?? (req.headers["content-type"] as string),
    );
    const projectId = stringValue(req.headers["x-project-id"] as string);
    const clientId = stringValue(req.headers["x-client-id"] as string);
    const kind = (stringValue(req.headers["x-document-kind"] as string) ?? "other").slice(0, 60);
    const visibility: Visibility = (isValidVisibility(stringValue(req.headers["x-visibility"] as string))
      ? (req.headers["x-visibility"] as string)
      : "internal") as Visibility;

    if (projectId && !isUuid(projectId)) {
      res.status(400).json({ error: "x-project-id must be a valid UUID" });
      return;
    }
    if (clientId && !isUuid(clientId)) {
      res.status(400).json({ error: "x-client-id must be a valid UUID" });
      return;
    }

    const documentId = randomUUID();
    const storage = getStorageProvider();
    const stored = await storage.store({ bytes, organizationId: organization.id, documentId, fileName, mimeType });

    const rows = await queryRows<{ id: string }>(sql`
      insert into documents (
        id,
        organization_id,
        project_id,
        client_id,
        uploaded_by_user_id,
        kind,
        visibility,
        file_name,
        mime_type,
        size_bytes,
        storage_bucket,
        storage_key,
        checksum_sha256
      ) values (
        ${documentId}::uuid,
        ${organization.id}::uuid,
        ${projectId}::uuid,
        ${clientId}::uuid,
        ${auth.user.id}::uuid,
        ${kind}::document_kind,
        ${visibility}::file_visibility,
        ${fileName},
        ${mimeType},
        ${stored.sizeBytes},
        ${stored.bucket},
        ${stored.key},
        ${stored.checksumSha256}
      )
      returning id::text
    `);

    if (!rows[0]?.id) throw new Error("Document upload insert did not return an id");

    await db.execute(sql`
      insert into activity_events (organization_id, actor_user_id, event_type, message, metadata)
      values (
        ${organization.id}::uuid,
        ${auth.user.id}::uuid,
        'file_uploaded',
        ${`uploaded ${fileName}`},
        ${JSON.stringify({ documentId, kind, visibility, projectId: projectId ?? null, clientId: clientId ?? null, sizeBytes: stored.sizeBytes })}::jsonb
      )
    `);

    res.status(201).json({
      ok: true,
      documentId: rows[0].id,
      fileName,
      sizeBytes: stored.sizeBytes,
      checksumSha256: stored.checksumSha256,
      downloadUrl: `/api/platform/documents/${rows[0].id}/download`,
    });
  },
);

/**
 * A media type safe to store and to echo back in a response header.
 *
 * `mime_type` arrives from the caller - a request body field on one route, the
 * `x-content-type` header on the other - and the download route sets it as the
 * response `Content-Type`. Node throws on a header value containing CR or LF,
 * so an unfiltered value turned a download into a 500; anything that is not a
 * plausible `type/subtype` is not worth storing either. Falls back rather than
 * rejecting, because the bytes are already uploaded by this point and a
 * generic type still downloads correctly.
 */
function normalizeMimeType(raw: string | null | undefined): string {
  const candidate = String(raw ?? "").split(";")[0].trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]{0,62}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,62}$/.test(candidate)) {
    return "application/octet-stream";
  }
  return candidate;
}

// ── Authenticated file download ──────────────────────────────────────────────

/**
 * Types that may be served for viewing in the browser rather than saved.
 *
 * A whitelist, not a blocklist, and deliberately short. Serving an arbitrary
 * uploaded file inline from the API origin is a stored-XSS vector: an uploaded
 * .html or .svg would run as a first-party script against this origin and any
 * cookie scoped to it. These five render as pictures or in the PDF viewer and
 * cannot carry script. SVG is excluded for exactly that reason, even though it
 * is an image - it is a document format that can hold <script>.
 */
const INLINE_VIEWABLE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);


router.get("/platform/documents/:documentId/download", async (req: Request, res: Response) => {
  const organization = req.tenant!;
  const auth = req.auth!;
  const documentId = stringValue(req.params.documentId);

  if (!documentId || !isUuid(documentId)) {
    res.status(400).json({ error: "A valid document id is required" });
    return;
  }

  const rows = await queryRows<{
    storageBucket: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    visibility: string;
  }>(sql`
    select
      storage_bucket as "storageBucket",
      storage_key as "storageKey",
      file_name as "fileName",
      mime_type as "mimeType",
      visibility::text
    from documents
    where id = ${documentId}::uuid
      and organization_id = ${organization.id}::uuid
      and deleted_at is null
  `);

  const doc = rows[0];
  if (!doc) {
    res.status(404).json({ error: "Document was not found" });
    return;
  }

  // Enforce visibility rules: internal docs only for staff roles
  const canSeeInternal = auth.user.role === "admin" || auth.user.role === "owner" ||
    auth.user.role === "chief" || auth.user.role === "pm";
  if (doc.visibility === "internal" && !canSeeInternal) {
    res.status(403).json({ error: "You do not have permission to access this document" });
    return;
  }

  try {
    const storage = getStorageProvider();
    const bytes = await storage.retrieve(doc.storageBucket, doc.storageKey);
    const ext = extname(doc.fileName) || "";
    const safeName = doc.fileName.replace(/[^\w.\-]/g, "_");
    // `?inline=1` asks for a viewable response instead of a save. The client
    // portal's document preview was a placeholder graphic reading "preview
    // unavailable" precisely because this always sent `attachment`, which a
    // browser cannot render in an <img> or <iframe>.
    const wantsInline = stringValue(req.query.inline) === "1";
    const canInline = wantsInline && INLINE_VIEWABLE_TYPES.has(doc.mimeType.toLowerCase());
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.setHeader(
      "Content-Disposition",
      `${canInline ? "inline" : "attachment"}; filename="${safeName}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=3600");
    // `nosniff` is the load-bearing header here, together with the whitelist.
    // `mime_type` is whatever was recorded at upload, so an HTML file could be
    // stored claiming to be a PDF; with the type pinned to application/pdf and
    // sniffing off, the browser hands it to the PDF reader, the parse fails and
    // nothing executes. It never becomes a document on this origin.
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (canInline) {
      // Deliberately not the `sandbox` directive, and the viewer iframe
      // deliberately carries no `sandbox` attribute either. Both put the
      // response in a sandboxed browsing context, which stops Chrome's built-in
      // PDF viewer rendering at all - that would restore the blank "preview
      // unavailable" pane this change exists to remove, in exchange for
      // defence the whitelist above already provides. Scripting is denied
      // instead, which is the part that mattered.
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; script-src 'none'; object-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'",
      );
    }
    res.send(bytes);
    void ext; // used above
  } catch {
    res.status(404).json({ error: "File could not be retrieved" });
  }
});

export default router;
