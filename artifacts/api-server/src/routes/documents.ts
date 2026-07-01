import { sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { db } from "@workspace/db";
import { requireAuth, requireRoles, type AuthContext } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";
import { getStorageProvider } from "../lib/storage";

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
  const kind = stringValue(data.kind) ?? "other";
  const visibility = stringValue(data.visibility) ?? "internal";
  const fileName = stringValue(data.fileName);
  const mimeType = stringValue(data.mimeType) ?? "application/octet-stream";
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

    const fileName = stringValue(req.headers["x-file-name"] as string) ?? "upload.bin";
    const mimeType = (stringValue(req.headers["x-content-type"] as string) ?? req.headers["content-type"] ?? "application/octet-stream").split(";")[0].trim();
    const projectId = stringValue(req.headers["x-project-id"] as string);
    const clientId = stringValue(req.headers["x-client-id"] as string);
    const kind = stringValue(req.headers["x-document-kind"] as string) ?? "other";
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

// ── Authenticated file download ──────────────────────────────────────────────

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
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(bytes);
    void ext; // used above
  } catch {
    res.status(404).json({ error: "File could not be retrieved" });
  }
});

export default router;
