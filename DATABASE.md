# PostgreSQL Database

This app now uses a real PostgreSQL database through Drizzle.

## Local Database

Start any PostgreSQL server and create a database named `ens`, or use the included compose file:

```powershell
docker compose up -d postgres
```

Use this local connection string:

```powershell
$env:DATABASE_URL="postgres://ens_app:ens_dev_password@localhost:5432/ens"
```

Apply the schema:

```powershell
pnpm run db:migrate
```

For development-only schema sync without migration history:

```powershell
pnpm run db:push
```

If your local database already contains the older partial schema from a previous run, preserve and upgrade it with:

```powershell
$env:PGPASSWORD="ens_dev_password"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -U ens_app -d ens -v ON_ERROR_STOP=1 -f .\lib\db\manual\upgrade-legacy-local.sql
```

## API Check

After starting the API with `DATABASE_URL` set, verify the database:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5000/api/db/status
```

The response includes connection latency and row counts for the core SaaS tables.

## Local Auth Accounts

The local seed users are backed by PostgreSQL and use HttpOnly cookie sessions through the API:

| Role | Email | Password |
| --- | --- | --- |
| Owner/Chief | `owner@ens.test` | `EnsDev2026!` |
| Project Manager | `pm@ens.test` | `EnsDev2026!` |
| Client | `client@ens.test` | `EnsDev2026!` |

Production must set a strong `AUTH_SECRET` and must not publish local test credentials.

## Tables

Core tables include organizations, users, memberships, sessions, invitations, clients, projects, project members, milestones, tasks, booth designs, booth versions, approvals, comments, documents, subscriptions, invoices, activity events, and notifications.
