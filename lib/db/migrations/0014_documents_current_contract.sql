-- Normalize databases upgraded from the legacy ENS document table to the
-- current production contract without discarding document metadata.
UPDATE "documents" d
SET
  "organization_id" = COALESCE(d."organization_id", p."organization_id"),
  "client_id" = COALESCE(d."client_id", p."client_id")
FROM "projects" p
WHERE p."id" = d."project_id"
  AND (d."organization_id" IS NULL OR d."client_id" IS NULL);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'name'
  ) THEN
    EXECUTE 'UPDATE "documents" SET "file_name" = COALESCE("file_name", "name")';
  END IF;

  IF EXISTS (SELECT 1 FROM "documents" WHERE "organization_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate documents with no recoverable organization';
  END IF;

  IF EXISTS (SELECT 1 FROM "documents" WHERE "file_name" IS NULL OR btrim("file_name") = '') THEN
    RAISE EXCEPTION 'Cannot migrate documents with no recoverable file name';
  END IF;

  IF EXISTS (SELECT 1 FROM "documents" WHERE "mime_type" IS NULL OR btrim("mime_type") = '') THEN
    RAISE EXCEPTION 'Cannot migrate documents with no MIME type';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "documents"
SET
  "visibility" = COALESCE("visibility", 'internal'::"file_visibility"),
  "storage_bucket" = COALESCE("storage_bucket", 'local');
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "project_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "file_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "mime_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "visibility" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "storage_bucket" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "name";
