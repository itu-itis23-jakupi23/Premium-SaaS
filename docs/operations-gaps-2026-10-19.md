# Operations gaps — 19 October 2026

A review of what actually runs, as opposed to what is verified. The
verification side of this project is strong; the operating side was close to
empty. This records what was closed, what was not, and why.

## The finding

Two numbers, measured rather than estimated:

- The branch was **80 commits ahead of origin**, whose last update was
  **24 August**. Every CI gate — four jobs, container verification, the
  Playwright suite, the secret scanner — had evaluated none of that work. A
  pipeline that never runs provides no assurance at all.
- `.release-evidence/container-deployment.json` had **never been produced**.
  The Docker topology had not once come up successfully. The production stack
  was, in the literal sense, untested.

Alongside those: no observability of any kind (no collector, no uptime check,
no alerting), container logs with no size limit, no resource limits, and a
backup script that was correct and ran on no schedule.

## Closed

**Container logs are capped.** Docker's default `json-file` driver has no
limit. A request path that logs on every call writes until the disk fills, and
a full disk stops Postgres — so the failure arrives as total data-layer
outage rather than as noisy logs. Now three files of 10 MB per service.

**Resource limits.** `mem_limit` and `cpus` on every service. Without them one
runaway container starves the rest, and the database dies alongside whatever
caused the problem. The values suit a small VPS and are meant to be raised
deliberately rather than discovered under load.

**The backup now runs.** `.github/workflows/backup.yml`, nightly at 02:15 UTC.
It runs the existing `verify-backup-restore.mjs` — which restores the dump and
compares every table and row count, so the dump is proven rather than assumed —
then retains the artefact in GitHub, off the application host. Pointed at a
scratch database built from the committed migrations until a production host
exists; set a `PRODUCTION_DATABASE_URL` secret and it switches target with no
other change.

**Images are published.** `.github/workflows/release.yml` builds both images on
`main` and on tags, publishing to GHCR tagged with the exact commit SHA —
because `latest` does not answer "what is running right now", which is the
question that gets asked during an incident.

## Not closed, and why

**There is no deploy step.** No host has been chosen. A deploy job pointing at
nothing would report success for nothing, which is worse than its absence.
When a host exists, add a job that pulls the tags above; the images will
already be built from a commit that passed CI.

**There is no error collector.** The code side is done:
`lib/error-reporting.ts` posts to `ERROR_WEBHOOK_URL` and the server warns at
boot when it is unset. It needs an account nobody here can create — a free
Sentry project, its DSN set as `ERROR_WEBHOOK_URL`. Perhaps thirty minutes,
and it is the difference between learning about a fault from your logs and
learning about it from a client.

**There is no staging.** Every first deploy would be to production, in front
of real clients.

**Secrets live in a `.env` file on one laptop.** Adequate now; not adequate
with customer data in production. The compose files already read every secret
from the environment, so moving to a managed secret store is configuration
rather than a rewrite.

**No replicas.** One Postgres, one API. Any single failure is an outage.

## Honest summary

The engineering judgement here is unusually good and has been spent almost
entirely on proving the code correct. What remained was operating it. Most of
that is configuration rather than invention — but configuration that does not
exist protects nothing, and the gap between "verified" and "running" was the
whole of it.
