-- Step 1: Repoint projects.client_id from each duplicate to its survivor.
-- projects.client_id has ON DELETE RESTRICT, so this must run before the DELETE.
WITH ranked AS (
  SELECT id, organization_id, lower(contact_email) AS key,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, lower(contact_email)
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM clients WHERE deleted_at IS NULL
),
merges AS (
  SELECT d.id AS dup_id, s.id AS survivor_id
  FROM ranked d
  JOIN ranked s ON s.organization_id = d.organization_id AND s.key = d.key AND s.rn = 1
  WHERE d.rn > 1
)
UPDATE projects SET client_id = merges.survivor_id::uuid
FROM merges WHERE projects.client_id = merges.dup_id::uuid;
--> statement-breakpoint

-- Step 2: Repoint documents (ON DELETE CASCADE — repoint to preserve records).
WITH ranked AS (
  SELECT id, organization_id, lower(contact_email) AS key,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, lower(contact_email)
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM clients WHERE deleted_at IS NULL
),
merges AS (
  SELECT d.id AS dup_id, s.id AS survivor_id
  FROM ranked d
  JOIN ranked s ON s.organization_id = d.organization_id AND s.key = d.key AND s.rn = 1
  WHERE d.rn > 1
)
UPDATE documents SET client_id = merges.survivor_id::uuid
FROM merges WHERE documents.client_id = merges.dup_id::uuid;
--> statement-breakpoint

-- Step 3: Repoint invoices (ON DELETE SET NULL — repoint to preserve billing link).
WITH ranked AS (
  SELECT id, organization_id, lower(contact_email) AS key,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, lower(contact_email)
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM clients WHERE deleted_at IS NULL
),
merges AS (
  SELECT d.id AS dup_id, s.id AS survivor_id
  FROM ranked d
  JOIN ranked s ON s.organization_id = d.organization_id AND s.key = d.key AND s.rn = 1
  WHERE d.rn > 1
)
UPDATE invoices SET client_id = merges.survivor_id::uuid
FROM merges WHERE invoices.client_id = merges.dup_id::uuid;
--> statement-breakpoint

-- Step 4: Repoint assignment history so the audit trail survives the merge.
WITH ranked AS (
  SELECT id, organization_id, lower(contact_email) AS key,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, lower(contact_email)
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM clients WHERE deleted_at IS NULL
),
merges AS (
  SELECT d.id AS dup_id, s.id AS survivor_id
  FROM ranked d
  JOIN ranked s ON s.organization_id = d.organization_id AND s.key = d.key AND s.rn = 1
  WHERE d.rn > 1
)
UPDATE project_assignment_history SET client_id = merges.survivor_id::uuid
FROM merges WHERE project_assignment_history.client_id = merges.dup_id::uuid;
--> statement-breakpoint

-- Step 5: Repoint activity events so operational history is retained.
WITH ranked AS (
  SELECT id, organization_id, lower(contact_email) AS key,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, lower(contact_email)
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM clients WHERE deleted_at IS NULL
),
merges AS (
  SELECT d.id AS dup_id, s.id AS survivor_id
  FROM ranked d
  JOIN ranked s ON s.organization_id = d.organization_id AND s.key = d.key AND s.rn = 1
  WHERE d.rn > 1
)
UPDATE activity_events SET client_id = merges.survivor_id::uuid
FROM merges WHERE activity_events.client_id = merges.dup_id::uuid;
--> statement-breakpoint

-- Step 6: Delete the now-safely-detached duplicate client rows.
DELETE FROM clients WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY organization_id, lower(contact_email)
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) AS rn
    FROM clients WHERE deleted_at IS NULL
  ) ranked WHERE rn > 1
);
--> statement-breakpoint

-- Step 7: Enforce uniqueness going forward.
CREATE UNIQUE INDEX "clients_org_email_unique" ON "clients"
  USING btree (organization_id, lower(contact_email))
  WHERE deleted_at IS NULL;
