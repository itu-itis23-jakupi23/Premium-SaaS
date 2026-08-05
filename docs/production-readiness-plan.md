# Premium SaaS Production Readiness Tracker

Last updated: 2026-08-05

Status values: `not started`, `in progress`, `blocked`, `implemented`, `verified`.

## Baseline

| Item                               | Status      | Evidence / limitation                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository architecture inventory  | implemented | pnpm monorepo; Express 5 API in `artifacts/api-server`; Vite/React staff and client builds in `artifacts/ens-landing`; secondary development server under `artifacts/ens-landing/server`; Drizzle/PostgreSQL in `lib/db`; iframe Three.js renderer in `public/booth-render.html`; Vitest and Playwright test suites; Docker Compose and GitHub Actions present. |
| Dirty worktree review              | implemented | Worktree contains broad intentional changes across CI, backend, migrations, renderer, portals, tests, and documentation. Nothing has been discarded or reset.                                                                                                                                                                                                   |
| Baseline release gate              | verified    | `pnpm run release:check` now passes typecheck, migrations, journal validation, 55 unit/integration tests, API build, authenticated workflow smoke, and staff/client production builds.                                                                                                                                                                          |
| Migration file/journal consistency | verified    | `pnpm run db:check-journal`: 15 ordered migrations passed. This checks repository metadata only, not database history.                                                                                                                                                                                                                                          |

## Phase 1: Reproducible Release Gate

| ID    | Requirement                                  | Status      | Relevant files                                                      | Verification / evidence                                                                                                                                                                           |
| ----- | -------------------------------------------- | ----------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RG-01 | One fail-fast release command for one commit | implemented | `scripts/release-check.mjs`, `package.json`                         | The deterministic gate now includes database fixtures, tests, smoke, builds, and isolated Playwright; security scans remain to be incorporated.                                                   |
| RG-02 | Deterministic dependency installation        | verified    | `pnpm-lock.yaml`, CI                                                | `pnpm install --frozen-lockfile` passes across all nine workspace projects and is mandatory in every CI job.                                                                                      |
| RG-03 | PostgreSQL startup and readiness             | implemented | `docker-compose.yml`, `docker-compose.dev.yml`                      | Must verify from clean environment.                                                                                                                                                               |
| RG-04 | Empty-database migrations                    | verified    | `lib/db/migrations`, Drizzle journal                                | All 15 migrations passed against a uniquely named empty disposable PostgreSQL database, which was removed after verification.                                                                     |
| RG-05 | Historical upgrade migration fixture         | verified    | `scripts/verify-database-migrations.mjs`                            | Disposable PostgreSQL fixture applies migrations 0000-0011, injects an interrupted 0012 state, completes 0012-0014, and asserts journal and schema integrity.                                     |
| RG-06 | Backend lint/static checks                   | in progress | API scripts                                                         | Typecheck exists; lint command absent.                                                                                                                                                            |
| RG-07 | Backend unit/integration tests               | verified    | API Vitest tests                                                    | 34 API tests pass against PostgreSQL.                                                                                                                                                             |
| RG-08 | Frontend lint/typecheck                      | in progress | root scripts                                                        | Typecheck passed; lint command absent.                                                                                                                                                            |
| RG-09 | Staff production build                       | verified    | Vite scripts                                                        | Production staff build passes.                                                                                                                                                                    |
| RG-10 | Client production build                      | verified    | Vite scripts                                                        | Production client build passes.                                                                                                                                                                   |
| RG-11 | Smoke workflow                               | verified    | `scripts/smoke-workflow.mjs`                                        | Release runner starts the production API on an isolated port and the authenticated workflow passes.                                                                                               |
| RG-12 | Full Playwright suite                        | verified    | `scripts/run-playwright-release.mjs`, `e2e`, Playwright config      | 38/38 browser tests passed against a disposable PostgreSQL database, production API, and isolated staff/client origins; the same runner is mandatory in the root gate and CI.                     |
| RG-13 | Dependency vulnerability scan                | verified    | `pnpm-workspace.yaml`, `pnpm-lock.yaml`, release/CI scripts         | Production audit passes the high-severity release threshold. The vulnerable `path-to-regexp` 8.3.0 resolution was overridden to patched 8.4.0; two low and one moderate advisory remain recorded. |
| RG-14 | Secret scan                                  | verified    | `scripts/scan-secrets.mjs`, release/CI scripts                      | Scanner passed across 589 tracked and untracked repository files and is mandatory in both the root release gate and CI.                                                                           |
| RG-15 | Machine-readable final summary               | verified    | `scripts/release-check.mjs`, `.release-evidence/release-check.json` | Passing report records commit, timestamps, status, failed step, and per-check durations.                                                                                                          |
| RG-16 | One-command local startup                    | in progress | Compose, package scripts, docs                                      | Compose exists; clean startup not proved.                                                                                                                                                         |
| RG-17 | Clean checkout / same-commit verification    | not started | release scripts, CI                                                 | Requires temporary checkout and commit evidence.                                                                                                                                                  |

## Release Blockers and Data Safety

| ID    | Requirement                               | Status      | Verification target                                                                                                                 |
| ----- | ----------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| RB-01 | PostgreSQL empty migration                | verified    | Existing database and a fresh disposable database both migrate successfully.                                                        |
| RB-02 | Historical upgrade migration              | verified    | Automated interrupted-upgrade fixture passes and removes its disposable database.                                                   |
| RB-03 | GitHub CI clean checkout                  | not started | Required GitHub checks green.                                                                                                       |
| RB-04 | Typed production environment validation   | verified    | Startup preflight rejects incomplete production database, auth, email, HTTPS cookie, storage, demo-data, and billing configuration. |
| RB-05 | Deployment configuration validation       | not started | Docker/Nginx/proxy/storage preflight.                                                                                               |
| RB-06 | Uploaded asset persistence across restart | verified    | Document and encrypted message attachment uploads survive a production API restart and download with identical SHA-256 checksums.   |
| RB-07 | Database backup creation                  | verified    | `pg_dump` custom-format backup is exercised automatically by `pnpm run db:verify-backup`.                                           |
| RB-08 | Restore into separate database            | verified    | Backup restores into a uniquely named database and all 25 public table names and row counts match the source.                       |

## Workspace and Renderer

| ID    | Requirement                                                     | Status      | Verification target                                       |
| ----- | --------------------------------------------------------------- | ----------- | --------------------------------------------------------- |
| WS-01 | Selection parity: floor, panel, column, fascia, room, furniture | in progress | Exact browser tests for each type.                        |
| WS-02 | Deterministic move/rotate/delete/undo/redo                      | in progress | State, scene, BOM, persistence parity.                    |
| WS-03 | Central transform precision and snap rules                      | not started | Shared configuration and unit tests.                      |
| WS-04 | X/Y/Z position and rotation controls                            | in progress | Browser interaction and save/reload.                      |
| WS-05 | Keyboard movement, duplication, locking, grouping, multi-select | in progress | Keyboard/accessibility tests.                             |
| WS-06 | Floor grounding and booth bounds                                | in progress | World-space bounds assertions across edit/preview/client. |
| WS-07 | Structural and room collision prevention                        | in progress | Columns, walls, fascia, room, furniture collision tests.  |
| WS-08 | Invalid-placement feedback and nearest valid position           | not started | Deterministic geometry tests and UX assertion.            |
| WS-09 | Complete deletion propagation                                   | in progress | Scene, selection, BOM, history, payload, server, preview. |
| WS-10 | Room corner snap, walls, doors, swing, ceiling, floor, graphics | in progress | Persistence and collision tests.                          |
| WS-11 | Fascia position/orientation/logo/text/duplication               | in progress | All side configurations and save/reload.                  |
| WS-12 | Wall graphics target only intended face                         | in progress | Face/orientation/crop/material tests.                     |
| WS-13 | GLB/texture/thumbnail failure states                            | not started | Broken-asset browser fixtures.                            |
| WS-14 | Three.js/WebGL resource disposal                                | in progress | Repeated navigation memory/context test.                  |
| WS-15 | Autosave, local recovery, concurrency and conflict UX           | in progress | Concurrent save and crash recovery tests.                 |
| WS-16 | Payload preflight and large binary separation                   | in progress | Boundary tests before API 413.                            |
| WS-17 | Production snapshot/image export                                | in progress | Resolution/framing/loaded-asset tests.                    |
| WS-18 | Mobile/tablet support or desktop-only guard                     | not started | Responsive browser tests.                                 |

## Furniture Catalogue

| ID    | Requirement                                                                                | Status      | Verification target                       |
| ----- | ------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------- |
| FC-01 | Authoritative SKU/name/description/dimensions/price/currency/stock/category/version/status | in progress | Schema and catalogue validation.          |
| FC-02 | GLB orientation/origin/scale/dimensions/material/texture/geometry validation               | not started | Publication validator over every model.   |
| FC-03 | Remove structural objects from furniture                                                   | in progress | Catalogue classification test.            |
| FC-04 | Categories, search, filters, recently used                                                 | in progress | Browser tests and large-list performance. |
| FC-05 | Thumbnails generated from actual GLBs                                                      | in progress | Deterministic thumbnail pipeline.         |
| FC-06 | Catalogue and asset version compatibility                                                  | not started | Old-project fixture retains exact asset.  |
| FC-07 | Rental stock/date concurrency rules                                                        | not started | Reservation conflict tests.               |
| FC-08 | Supported material/color variants                                                          | not started | Variant persistence tests.                |

## Canonical Business Workflow

| ID    | Requirement                                                                                                               | Status      | Verification target                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| WF-01 | Central intake -> approval -> assignment -> draft -> submit -> review -> approve/revise -> quote -> invoice state machine | in progress | Shared transition definitions and full workflow test. |
| WF-02 | Every transition authorized, scoped, transactional, audited, idempotent                                                   | in progress | Route-level concurrency and audit assertions.         |
| WF-03 | Chief intake queue and exactly one canonical project                                                                      | in progress | Signup-to-queue browser and duplicate retry test.     |
| WF-04 | Chief-only assignment/reassignment/override and history                                                                   | in progress | Authorization matrix tests.                           |
| WF-05 | Exhibitions separate from projects                                                                                        | in progress | Schema/API/UI assertions.                             |
| WF-06 | Synchronized progress and exact submitted version across portals                                                          | in progress | Three-role E2E.                                       |
| WF-07 | Chief detail combines project/workspace and opens exact version                                                           | in progress | Browser test.                                         |
| WF-08 | PM capacity confirmation and audit                                                                                        | in progress | Boundary and override tests.                          |
| WF-09 | PM calendar opens selected PM and assigned exhibitions                                                                    | in progress | Browser test.                                         |
| WF-10 | No random/demo values; real zero states and persisted reports                                                             | in progress | Empty organization fixture.                           |
| WF-11 | SLA warnings for unassigned/overdue/stalled work                                                                          | in progress | Controlled-clock tests.                               |
| WF-12 | PM sees only assigned work and intake requirements                                                                        | in progress | Cross-PM isolation test.                              |
| WF-13 | Send to Client creates immutable version; revision creates new draft                                                      | in progress | API and browser immutability tests.                   |
| WF-14 | Client onboarding states and useful pre-assignment empty states                                                           | in progress | Signup lifecycle E2E.                                 |
| WF-15 | Client approval/revision atomic and idempotent                                                                            | in progress | Concurrent request test.                              |
| WF-16 | Approved quote creates invoice exactly once                                                                               | implemented | Must be included in full PostgreSQL gate.             |

## Messaging, Documents, and Uploads

| ID    | Requirement                                           | Status      | Verification target                                                                                                                               |
| ----- | ----------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| MD-01 | One canonical conversation model and ID               | in progress | Shared API model and cross-portal E2E.                                                                                                            |
| MD-02 | Chief-PM, PM-client, permitted Chief-client messaging | in progress | Exact browser tests for each allowed path.                                                                                                        |
| MD-03 | Eliminate context-related 403s                        | in progress | Authorization matrix and project/general conversation tests.                                                                                      |
| MD-04 | Read state, unread count, last-message preview        | in progress | Multi-session tests.                                                                                                                              |
| MD-05 | Attachment authorization and controlled URLs          | in progress | Authorized/denied download tests.                                                                                                                 |
| MD-06 | MIME/extension/size/name/path/collision validation    | in progress | Malicious and boundary fixtures.                                                                                                                  |
| MD-07 | Malware-scanning integration point                    | not started | Provider abstraction and quarantine behavior.                                                                                                     |
| MD-08 | Delivery/failure/retry/progress states                | in progress | Browser and API failure tests.                                                                                                                    |
| MD-09 | Long-thread pagination/virtualization                 | not started | Large conversation performance test.                                                                                                              |
| MD-10 | Encryption key rotation and previous-key decryption   | in progress | Rotation integration test.                                                                                                                        |
| MD-11 | Durable upload storage and restart integrity          | verified    | Local durable storage and encrypted attachment integrity are verified across production API restart; Docker mounts `/app/data` on a named volume. |

## Backend, Database, Authentication, and Security

| ID    | Requirement                                                     | Status      | Verification target                                                                                                                    |
| ----- | --------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| BE-01 | PostgreSQL only production source of truth; isolate dev backend | in progress | Production build/config test.                                                                                                          |
| BE-02 | Transactions for every multi-step workflow                      | in progress | Fault injection and rollback tests.                                                                                                    |
| BE-03 | Explicit organization scoping in every query                    | in progress | Cross-org matrix coverage.                                                                                                             |
| BE-04 | Database constraints match business invariants                  | in progress | Migration and constraint tests.                                                                                                        |
| BE-05 | Lossless client deduplication                                   | in progress | Historical relationship fixture.                                                                                                       |
| BE-06 | Idempotency and optimistic concurrency                          | in progress | Concurrent write tests.                                                                                                                |
| BE-07 | Standard API errors/status codes/pagination/stable sorting      | in progress | Contract tests.                                                                                                                        |
| BE-08 | No request-path DDL or schema repair                            | in progress | Static scan and startup migration enforcement.                                                                                         |
| BE-09 | Cleanup for sessions/invitations/uploads/exports                | in progress | Scheduled job tests.                                                                                                                   |
| BE-10 | Security audit logging                                          | in progress | Actor/org/action evidence tests.                                                                                                       |
| BE-11 | Currency provider abstraction and financial snapshots           | not started | Historical invoice immutability tests.                                                                                                 |
| AU-01 | Invitation-only production staff creation                       | in progress | Production-mode route tests.                                                                                                           |
| AU-02 | Secure cookies/proxy/CORS/CSRF/CSP/iframe/upload headers        | in progress | Deployment-mode integration tests.                                                                                                     |
| AU-03 | Email verification and password reset delivery                  | in progress | Local mail/test-provider flow.                                                                                                         |
| AU-04 | Complete or hide unfinished 2FA                                 | not started | Production UI and auth behavior.                                                                                                       |
| AU-05 | Session management and forced logout after account/role changes | in progress | Existing-session invalidation test.                                                                                                    |
| AU-06 | Lockout recovery and Chief-assisted disabling                   | in progress | Browser/API tests.                                                                                                                     |
| AU-07 | Dependency and secret scanning                                  | verified    | Production dependency audit and repository secret scan are mandatory release and CI checks.                                            |
| AU-08 | Deny-by-default authorization matrix                            | verified    | Contract documented in `docs/authorization-matrix.md`; 48 table-driven unauthenticated, disallowed-role, and cross-tenant checks pass. |

## Performance, Accessibility, and Localization

| ID    | Requirement                                                             | Status      | Verification target                    |
| ----- | ----------------------------------------------------------------------- | ----------- | -------------------------------------- |
| PF-01 | Route, API, bundle, FPS, memory, asset performance baseline and budgets | not started | `docs/performance-baseline.md`.        |
| PF-02 | Safe route prefetch and elimination of duplicate requests               | in progress | Network trace comparison.              |
| PF-03 | Lazy charts/workspace and smaller chart imports                         | in progress | Build artifact budgets.                |
| PF-04 | Virtualized client/project/message/catalogue lists                      | not started | Large fixture responsiveness.          |
| PF-05 | GLB/texture/thumbnail optimization and cache headers                    | not started | Asset audit.                           |
| AX-01 | Keyboard navigation and focus restoration                               | in progress | Critical-flow keyboard tests.          |
| AX-02 | Accessible names/live regions/focus/contrast                            | in progress | Automated scan plus manual review.     |
| AX-03 | Screen-reader flows across all portals                                  | not started | Manual evidence.                       |
| AX-04 | Remove hardcoded English and verify all locales/Arabic RTL              | in progress | Locale completeness and browser tests. |
| AX-05 | Long-name wrapping and standardized status presentation                 | in progress | Visual regression fixtures.            |
| AX-06 | Hide unfinished controls in production                                  | not started | Production-mode UI assertions.         |
| AX-07 | Reduced motion and responsive laptop validation                         | in progress | Browser emulation tests.               |

## Observability, Operations, and Deployment

| ID    | Requirement                                                            | Status      | Verification target                                                                                         |
| ----- | ---------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| OP-01 | Structured logs with request and organization context                  | in progress | Log contract test without sensitive content.                                                                |
| OP-02 | Frontend/backend error-monitoring integration points                   | not started | Provider-neutral hooks.                                                                                     |
| OP-03 | Metrics for latency/errors/DB/uploads/email/messages/approvals/storage | not started | Metrics endpoint or documented export.                                                                      |
| OP-04 | Readiness/liveness probes                                              | implemented | Must verify in Compose and production build.                                                                |
| OP-05 | Alert conditions and retention policies                                | verified    | `docs/operations-runbook.md`.                                                                               |
| OP-06 | Backup, restore, DR, account/assignment/project recovery               | not started | Exercise plus runbooks.                                                                                     |
| OP-07 | Deployment rollback and service-level objectives                       | verified    | Deployment, rollback, and SLO documents.                                                                    |
| OP-08 | Typed environment profiles and deployment preflight                    | verified    | Development, test, local, staging, and strict production profiles are validated at API startup.             |
| OP-09 | `.env.example` with documented non-secret variables                    | verified    | Root example documents deployment profile, credentials, storage, email, limits, billing, and demo controls. |

Required documents:

- `docs/authorization-matrix.md` — implemented; expand alongside every new protected route
- `docs/performance-baseline.md` — not started
- `docs/operations-runbook.md` — verified
- `docs/backup-and-restore.md` — implemented
- `docs/deployment-and-rollback.md` — verified
- `docs/service-level-objectives.md` — verified

## Required Automated Test Coverage

| Coverage                                                                                     | Status      |
| -------------------------------------------------------------------------------------------- | ----------- |
| Clean migration and historical upgrade                                                       | verified    |
| Full Chief -> PM -> Client workflow on production API/PostgreSQL                             | verified    |
| Concurrent invitation/workspace/approval/assignment/review operations                        | in progress |
| Large workspace and attachment boundaries                                                    | in progress |
| Expired/revoked invitations and active-session role changes                                  | in progress |
| Cross-organization isolation for every resource                                              | in progress |
| Renderer selection/placement/grounding/collision/deletion/scaling/rotation/preview/save/undo | in progress |
| Currency snapshot and invoice exactly-once                                                   | in progress |
| Browser messaging with active API                                                            | verified    |
| Persistence after restart                                                                    | verified    |
| Authorization matrix coverage                                                                | verified    |
| Backup restoration validation                                                                | verified    |

## Current Highest-Priority Work

1. Run the complete gate from a clean checkout.

## Verification Log

| Date       | Command                                                                    | Commit                     | Result                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-05 | `pnpm run db:check-journal`                                                | `6d25bdf` + dirty worktree | Passed: 15 ordered migrations.                                                                                                                                                                                 |
| 2026-08-05 | `pnpm run release:check`                                                   | `6d25bdf` + dirty worktree | Failed after typecheck at `db:migrate`: PostgreSQL `42710`, type `approval_status` already exists.                                                                                                             |
| 2026-08-05 | `pnpm run db:reconcile-journal`                                            | `6d25bdf` + dirty worktree | Safely reconciled all 15 migrations after verifying concrete schema markers; no application rows changed.                                                                                                      |
| 2026-08-05 | `pnpm --filter @workspace/db run migrate`                                  | `6d25bdf` + dirty worktree | Passed against the repaired local PostgreSQL database.                                                                                                                                                         |
| 2026-08-05 | disposable PostgreSQL database + `pnpm --filter @workspace/db run migrate` | `6d25bdf` + dirty worktree | Passed all 15 migrations from an empty database; disposable database removed afterward.                                                                                                                        |
| 2026-08-05 | `pnpm run release:check`                                                   | `6d25bdf` + dirty worktree | Passed typecheck, migrations, journal validation, 21 API schema tests, 34 API tests, API build, authenticated workflow smoke, staff build, and client build.                                                   |
| 2026-08-05 | evidence-enabled `pnpm run release:check`                                  | `6d25bdf` + dirty worktree | Passed 9 gate steps and wrote a machine-readable passing report for commit `6d25bdfb7cf64a0c4c8dfa00bdd924b18f40cf06`.                                                                                         |
| 2026-08-05 | `pnpm run db:verify-migrations`                                            | `6d25bdf` + dirty worktree | Passed clean-database and interrupted historical-upgrade fixtures; both disposable databases were removed.                                                                                                     |
| 2026-08-05 | migration-fixture-enabled `pnpm run release:check`                         | `6d25bdf` + dirty worktree | Passed all 10 gate steps and wrote machine-readable release evidence.                                                                                                                                          |
| 2026-08-05 | `pnpm run e2e:release`                                                     | `6d25bdf` + dirty worktree | Passed 38/38 tests in 2.7 minutes against a disposable PostgreSQL database, production API, and separate staff/client portal origins; database and service processes were cleaned up.                          |
| 2026-08-05 | `pnpm run security:secrets`                                                | `6d25bdf` + dirty worktree | Passed across 589 tracked and untracked files.                                                                                                                                                                 |
| 2026-08-05 | `pnpm run security:audit`                                                  | `6d25bdf` + dirty worktree | Passed the high-severity threshold after pinning `path-to-regexp` 8.4.0; two low and one moderate advisory remain.                                                                                             |
| 2026-08-05 | `pnpm run db:verify-backup`                                                | `6d25bdf` + dirty worktree | PostgreSQL custom-format backup restored into a separate disposable database; all 25 public table names and row counts matched.                                                                                |
| 2026-08-05 | `pnpm run storage:verify-restart`                                          | `6d25bdf` + dirty worktree | Document and encrypted message attachment survived a production API restart with matching SHA-256 checksums.                                                                                                   |
| 2026-08-05 | `pnpm install --frozen-lockfile`                                           | `6d25bdf` + dirty worktree | Passed across all nine workspace projects with the patched dependency resolution locked.                                                                                                                       |
| 2026-08-05 | expanded `pnpm run release:check`                                          | `6d25bdf` + dirty worktree | Passed all 15 evidence-producing gates, including security scans, migration fixtures, backup/restore, restart persistence, both production builds, and 38 Playwright tests.                                    |
| 2026-08-05 | authorization matrix suite                                                 | `6d25bdf` + dirty worktree | Passed 48/48 unauthenticated, disallowed-role, and representative cross-organization checks; full API suite passed 82/82 and monorepo typecheck passed.                                                        |
| 2026-08-05 | production environment preflight                                           | `6d25bdf` + dirty worktree | Strict production startup validation added with three profile tests; full API suite passed 85/85 and monorepo typecheck passed.                                                                                |
| 2026-08-05 | post-hardening `pnpm run release:check`                                    | `6d25bdf` + dirty worktree | Passed all 15 gates in 3m52s: typecheck, migrations, security, backup/restore, 21 schema tests, 85 API tests, API build, restart persistence, workflow smoke, staff/client builds, and 38/38 Playwright tests. |

## Known Limitations

- Baseline is against a dirty worktree, not a clean commit.
- Local database had unjournaled schema objects from an interrupted deployment. The schema and journal are now consistent, and both clean and interrupted-upgrade migration paths are covered by disposable-database verification.
- The root release gate now runs Playwright and both security scans; remote Action status was not inspected in this session.
- No production-readiness claim is valid until clean-room verification passes.
