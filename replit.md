# ENS Premium SaaS — Exhibition Booth Design Platform

A multi-portal SaaS for exhibition-stand agencies: chiefs manage clients and
project managers, PMs design booths in a real-time 3D workspace (Octanorm /
Maxima systems with live BOM, pricing, and weight), and clients review and
approve designs from their own portal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev:watch` — API server with hot reload (port 5000; needs `DATABASE_URL` in the shell)
- `pnpm --filter @workspace/ens-landing run dev` — combined portal on 5173
- `pnpm --filter @workspace/ens-landing run dev:staff` — staff portal build on 5174 (asks for `VITE_STAFF_ACCESS_CODE` from `.env.staff` before login)
- `pnpm --filter @workspace/ens-landing run dev:client` — client portal build on 5175
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run db:migrate` / `pnpm run db:push` — apply schema (see DATABASE.md)
- `pnpm run db:seed` — idempotent demo accounts (owner/pm/client `@ens.test`, password `EnsDev2026!`)
- `pnpm run db:clean-test-data` — purge e2e/smoke junk users and orgs from the dev DB
- `pnpm run e2e` — Playwright suite (runs from `artifacts/ens-landing`)
- Required env: `DATABASE_URL` — canonical local DB is `premium_saas` (see DATABASE.md)

## Stack

- pnpm workspaces, Node.js 24+, TypeScript 5.9
- Frontend: React 19, Vite 7, wouter, TanStack Query, Tailwind 4, Radix UI, i18next (11 locales), framer-motion
- API: Express 5, pino, Drizzle ORM, PostgreSQL
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Payments/email/storage: Stripe, Resend, local-disk or S3 provider
- Build: esbuild (CJS bundle for API), Playwright for e2e

## Where things live

- `artifacts/ens-landing/` — the entire frontend (all three portals share one codebase; `VITE_PORTAL` env splits staff/client builds). Pages in `src/pages/{chief,pm,client}`, the 3D booth workspace is `src/pages/pm/PMWorkspace.tsx` (used by chief + PM).
- `artifacts/ens-landing/server/` — dev/demo backend used by some e2e flows
- `artifacts/api-server/` — production Express API (`src/routes/*.ts`)
- `lib/db/` — Drizzle schema (`src/schema/index.ts` is the single source of truth), migrations, seed
- `lib/api-zod/`, `lib/api-spec/`, `lib/api-client-react/` — API contract layers
- `scripts/` — repo maintenance scripts (migration journal checks, schema repair, test-data cleanup)
- i18n: `artifacts/ens-landing/src/i18n/locales/*.json` — en is the base; keep all 11 in sync when changing keys

## Architecture decisions

- One React app serves three portals; `src/lib/portal.ts` gates roles per build mode and per port (5173 all / 5174 staff / 5175 client). Auth cookies are namespaced per portal.
- Assigning a PM to a client auto-creates that client's exhibition and booth project (`Acme Corp Exhibition` pattern). The Projects board's empty state explains this; the manual Add Exhibition flow also exists for planning ahead.
- The chief's booth workspace route is `/chief/workspace` (shared `PMWorkspace` component). `/chief/workspace-monitor` is a legacy alias that redirects there — do not link to it in new code.
- Sessions are httpOnly cookies with server-side rate-limited login (`login_rate_limits` table) plus a client-side lockout mirror.
- `lib/db` falls back to `postgresql://postgres:postgres@localhost:5432/premium_saas` when `DATABASE_URL` is unset — keep that in sync with root `.env`.

## Product

- Chief portal: client CRM (approve/assign/archive), manager workload + ratings, projects Kanban/list with live workspace status, calendar, messaging, reports, org settings.
- PM portal: assigned clients, projects, tasks kanban, 3D booth workspace, revision requests, calendar, messaging.
- Client portal: project dashboard, read-only booth workspace with approval + comments, documents, messaging, profile.
- 3D workspace: stand configurator (dimensions, system, open sides, fascia), furniture catalog with SKUs/stock, per-item placement, BOM export (CSV/TXT), price + weight totals, version history, send-to-client approval flow.

## User preferences

- Owner communicates in English; UI ships 11 locales with English as the base.
- Keep user-facing copy business-friendly — no database/engine jargon in the UI.

## Gotchas

- The staff dev portal (5174) needs the access code from `artifacts/ens-landing/.env.staff` before the login form appears.
- e2e suites pollute the dev DB with `*@workflow.test` / `smoke.*@example.com` / `*@e2e.test` accounts — run `pnpm run db:clean-test-data` afterwards.
- A stale local `ens` database (role `ens_app`) may exist from an older setup; it is unused. Everything targets `premium_saas`.
- `.log` files in the repo root are dev-server output and are gitignored; they are not part of the app.

## Pointers

- DATABASE.md — local DB setup, seeding, cleanup
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
