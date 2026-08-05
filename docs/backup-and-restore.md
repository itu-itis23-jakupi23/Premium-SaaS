# Backup and Restore

## Automated release proof

Run from the repository root with `DATABASE_URL` set:

```powershell
pnpm run db:verify-backup
pnpm run storage:verify-restart
```

`db:verify-backup` creates a PostgreSQL custom-format backup, restores it into a uniquely named separate database, compares every public table and row count, then removes both the restore database and temporary dump.

`storage:verify-restart` creates an isolated database and storage directory, uploads a document and encrypted message attachment, restarts the production API, verifies both downloads by SHA-256 checksum, and removes all temporary state.

Both commands refuse disposable-database operations on non-local hosts unless `ALLOW_DISPOSABLE_DATABASE_TEST=1` is explicitly set. Use that override only for an isolated CI database server.

## Production backup

Use PostgreSQL client tools from the same major version as the production server:

```bash
pg_dump --format=custom --no-owner --no-privileges \
  --file premium-saas-$(date +%Y%m%d-%H%M%S).dump "$DATABASE_URL"
```

Store dumps encrypted in a separate account or region. Do not place them in the repository, application container, or the same volume as PostgreSQL.

Back up object storage independently. For local-volume deployments, snapshot the volume mounted at `/app/data`, which contains both `documents` and `message-attachments`. A database-only backup is incomplete because document rows reference files in that storage.

## Restore exercise

Never test a restore over the production database.

1. Create a new empty database.
2. Restore with `pg_restore --no-owner --no-privileges --exit-on-error --dbname "$RESTORE_DATABASE_URL" backup.dump`.
3. Point a temporary API instance at the restore database and a restored copy of object/file storage.
4. Verify `/api/healthz/ready`, account login, project/workspace reads, and authorized document and message-attachment downloads.
5. Compare table counts and file checksums with the source evidence.
6. Remove the temporary environment only after recording the result.

## Required schedule

- Database: daily full backup, retained for 30 days.
- Upload storage: daily snapshot or provider versioning, retained for 30 days.
- Restore drill: monthly and before every database-major-version upgrade.
- Release gate: run the automated backup and restart exercises for every release candidate.

Record backup timestamp, commit, database server version, dump checksum, storage snapshot identifier, restore duration, validation result, and operator. Any failed restore drill blocks release until corrected.
