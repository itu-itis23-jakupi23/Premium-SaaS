# Operations Runbook

## Ownership And Severity

| Severity | Definition                                                         | Acknowledge    | Update cadence |
| -------- | ------------------------------------------------------------------ | -------------- | -------------- |
| SEV-1    | Login, database, workspace save/submit, or all portals unavailable | 15 minutes     | 30 minutes     |
| SEV-2    | One role/workflow unavailable, attachment loss risk, elevated 5xx  | 30 minutes     | 60 minutes     |
| SEV-3    | Degraded performance or non-critical feature failure               | 1 business day | Daily          |

The incident lead owns coordination and timeline. The technical lead owns mitigation. A separate recorder preserves commands, timestamps, request IDs, deployment SHA, and decisions.

## First Response

1. Record UTC start time, affected portals/roles/organizations, and the current deployment SHA.
2. Check `/api/healthz` and `/api/healthz/ready`. A failing readiness probe means the instance must not receive traffic.
3. Inspect structured API logs by request ID, route, status, and organization. Never paste cookies, authorization headers, reset tokens, invite tokens, or message bodies into incident channels.
4. Check database connections, storage availability, email delivery, and recent deployment/migration events.
5. If impact started after deployment, follow [Deployment And Rollback](deployment-and-rollback.md).
6. Preserve evidence before restarting or scaling services.

## Alert Conditions

| Signal                         | Warning             | Critical                                  |
| ------------------------------ | ------------------- | ----------------------------------------- |
| API 5xx rate                   | > 1% for 10 min     | > 5% for 5 min                            |
| API p95 latency                | > 750 ms for 15 min | > 2 s for 10 min                          |
| Readiness failures             | 2 consecutive       | 5 minutes continuous                      |
| Database pool saturation       | > 80% for 15 min    | > 95% for 5 min                           |
| Login failures                 | 3x normal baseline  | Broad valid-user failures or refresh loop |
| Workspace save/submit failures | > 1% for 10 min     | Any sustained customer data-loss risk     |
| Upload/download failures       | > 2% for 15 min     | Durable storage unavailable               |
| Email failures                 | > 5% for 30 min     | Invitations/password recovery unavailable |
| Pending approvals              | Oldest > 3 days     | Oldest > 5 days                           |
| Unassigned client/project      | Oldest > 24 hours   | Oldest > 48 hours                         |
| Backup exercise                | Older than 7 days   | Older than 14 days or failed restore      |

## Health And Release Commands

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5000/api/healthz
Invoke-WebRequest -UseBasicParsing http://localhost:5000/api/healthz/ready
pnpm run release:check
pnpm run db:verify-backup
pnpm run storage:verify-restart
pnpm run e2e:release
```

Release evidence is written to `.release-evidence/release-check.json`. A release is invalid if the evidence SHA differs from the deployed commit, any step is skipped without an approved exception, or the worktree used to build was dirty.

## Database Recovery

- Stop writes before point-in-time recovery or destructive repair.
- Take a fresh backup even when the database is damaged enough to require recovery.
- Restore into a separate database first; never test a restore over production.
- Compare migration journal, table inventory, row counts, and critical organization/project/workspace records.
- Follow [Backup And Restore](backup-and-restore.md). `pnpm run db:verify-backup` is an exercise, not the production backup scheduler.
- Never run `db:reconcile-journal` without verifying the concrete schema markers documented by the command output.

## Object Storage Recovery

1. Confirm whether metadata exists in PostgreSQL and whether the referenced object exists in durable storage.
2. Do not recreate an object under the same key unless its checksum and authorization metadata are known.
3. Restore the storage snapshot/version, then verify an authorized download and a denied cross-tenant download.
4. Run `pnpm run storage:verify-restart` against the candidate environment before returning writes.

## Account And Assignment Recovery

- Disable compromised users and revoke all sessions before changing assignments.
- Chief role and organization membership changes require session invalidation.
- Recover PM/client assignments through the Chief workflow so assignment history and activity events remain intact.
- Do not edit project ownership directly unless the application workflow is unavailable and an audited SQL change is approved.
- Validate that Chief, PM, and client each see the same project lifecycle after recovery.

## Retention

| Data                         | Minimum retention                                                |
| ---------------------------- | ---------------------------------------------------------------- |
| Security/auth/audit logs     | 180 days                                                         |
| Operational API logs         | 30 days searchable, 90 days archived                             |
| Release evidence             | Indefinite for every production release                          |
| Database backups             | 30 daily, 12 monthly                                             |
| Incident records/postmortems | Indefinite                                                       |
| Deleted customer uploads     | Per contract and deletion policy; never indefinitely by accident |

## Incident Closure

Resolve only after customer workflows are verified, monitoring is stable for at least 30 minutes, queued work is reconciled, and the incident timeline is complete. SEV-1/2 incidents require a blameless postmortem with root cause, detection gap, corrective owner, deadline, and regression test.
