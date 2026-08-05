# PostgreSQL Database

The app uses PostgreSQL through Drizzle ORM. The schema source of truth is
`lib/db/src/schema/`; migrations live in `lib/db/migrations/`.

## Local development setup (canonical)

The local dev database is **`premium_saas`** on a locally installed PostgreSQL
(any recent version; 16 is known-good). Connection values come from the root
`.env` file:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/premium_saas
```

The API server does **not** load `.env` files itself — `DATABASE_URL` must be
present in the shell environment when you start it:

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/premium_saas"
pnpm --filter @workspace/api-server run dev:watch
```

If you prefer Docker instead of a native install, `docker-compose.dev.yml`
starts only Postgres (it reads `POSTGRES_DB` / `POSTGRES_USER` /
`POSTGRES_PASSWORD` from the environment or root `.env`):

```powershell
docker compose -f docker-compose.dev.yml up -d
```

> Historical note: older docs referenced an `ens` database owned by an
> `ens_app` role. That database may still exist locally but is **stale and
> unused** — everything runs against `premium_saas`.

## Apply the schema

```powershell
pnpm run db:migrate     # migration history (preferred)
pnpm run db:push        # dev-only direct schema sync
```

## Seed demo accounts

```powershell
pnpm run db:seed
```

The seed is idempotent — safe to re-run; it upserts by email/slug. Accounts:

| Role | Email | Password |
| --- | --- | --- |
| Owner/Chief | `owner@ens.test` | `EnsDev2026!` |
| Project Manager | `pm@ens.test` | `EnsDev2026!` |
| Client | `client@ens.test` | `EnsDev2026!` |

The staff portal (`:5174`) additionally asks for the company access code
before showing the login form — locally that is `VITE_STAFF_ACCESS_CODE` in
`artifacts/ens-landing/.env.staff`.

Production must set a strong `AUTH_SECRET` and must not publish local test
credentials.

## Clean up e2e/smoke test data

E2E and smoke runs create throwaway users (`*@example.com` with `smoke.`
prefixes, `*@workflow.test`, `*@e2e.test`). Purge them with:

```powershell
pnpm run db:clean-test-data
```

The script only deletes rows whose email matches those test patterns (plus
their memberships, sessions, and dependent rows) and prints a summary. Run it
whenever the dev database accumulates junk.

## Health check

With the API running (`PORT` 5000):

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5000/api/healthz/ready
```

`/api/db/status` returns connection latency and row counts but requires an
authenticated session.

## Tables

Core tables: organizations, users, memberships, sessions, invitations,
clients, projects, project members, milestones, tasks, booth designs, booth
versions, approvals, comments, documents, direct conversations/messages,
subscriptions, invoices, stripe webhook events, login rate limits, password
reset tokens, activity events, and notifications.
