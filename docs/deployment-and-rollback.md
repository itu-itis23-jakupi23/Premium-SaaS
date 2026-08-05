# Deployment And Rollback

## Release Preconditions

1. Build from a clean, reviewed commit. Record the commit SHA and immutable image digest.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm run release:check`; retain `.release-evidence/release-check.json`.
4. Confirm strict `DEPLOYMENT_ENV=production` startup preflight passes with real secret references, HTTPS origins, email, and durable storage.
5. Take and verify a database backup before applying migrations.
6. Confirm the previous application image remains deployable.

## Deployment Sequence

1. Put irreversible workflow/background jobs into maintenance mode where applicable.
2. Apply database migrations once from a dedicated migration job. Application replicas must not race migrations.
3. Deploy one canary API instance and verify liveness, readiness, login, workspace read/save, and attachment download.
4. Deploy the remaining API instances, then staff and client frontends.
5. Run a production-safe smoke: Chief login, PM assigned-project read, client submitted-version read, message round trip, and a non-destructive upload/download.
6. Monitor the alert signals in [Operations Runbook](operations-runbook.md) for at least 30 minutes.

## Application Rollback

Rollback when canary checks fail, 5xx/latency crosses critical thresholds, authentication loops, authorization regresses, or workspace persistence is uncertain.

1. Stop rollout and preserve logs/evidence.
2. Route traffic to the previous immutable API/frontend images.
3. Do not automatically reverse database migrations. Current migrations are forward-only unless a reviewed down migration and data-loss analysis exist.
4. If the previous application is incompatible with the migrated schema, deploy a forward compatibility fix or restore into a separate database and follow the data-recovery decision process.
5. Verify all three roles and the exact affected workflow before declaring rollback complete.

## Database Rollback Decision

Database restore is a last resort because it can discard writes after the backup. The incident lead must document the recovery point, expected lost-write window, customer impact, and approval. Prefer a forward data repair when integrity can be proved.

## Configuration Rollback

Secrets and environment variables are versioned as deployment configuration, not committed files. Roll back configuration independently only when schema/application compatibility is unchanged. Rotated message-encryption keys cannot simply be reverted after new data is written; use a versioned key migration.

## Post-Deployment Evidence

Record commit SHA, image digests, migration journal head, release-evidence artifact, deployment timestamps, operator, canary results, production-safe smoke result, and rollback decision. A deployment without this record is not a verified release.
