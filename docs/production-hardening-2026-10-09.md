# Production hardening: 2026-10-09

This work improves the current working tree. It does not certify a deployed
production environment or replace the remaining launch checks in
[the readiness tracker](production-readiness-plan.md).

## Invoice integrity

Payment recording, balance settlement, and voiding acquire a PostgreSQL row
lock on the same invoice. The balance is read after acquiring the lock, so
concurrent requests across API processes cannot spend the same outstanding
balance. Ledger entries, cached balances, paid status, and payment audit events
commit in one transaction. Failure rolls them all back.

Payments require an integer number of cents within the database column's range.
Invoices with a recorded deposit cannot be voided; a refund or credit workflow
must be defined before allowing that transition. Issuing and deleting drafts
use conditional updates so they cannot overwrite a concurrent status change.

Integration tests exercise concurrent payments, repeated settlement, settlement
versus voiding, repeated issuing, issuing versus voiding, and a real PostgreSQL
trigger failure on audit insertion followed by a successful retry.

This is concurrency protection, not a general payment idempotency contract.
Explicit request keys and replay handling for ambiguous network failures remain
necessary before introducing automatic retries of payment mutations.

## Notification isolation

Shared delivery and the platform notification wrapper require an active
membership in the sending organization. Deleted and disabled accounts do not
receive notifications. Invoice and quote recipient lookup checks the same
membership and account conditions. Delivery preserves category preferences and
rechecks recipient eligibility in the insertion statement.

Integration coverage includes an unrelated organization, invited/suspended/
revoked membership, deleted/disabled accounts, and category opt-outs.

## Dependency security

The production audit exposed GHSA-jqcg-44mw-7w3h in `proxy-addr`. The workspace
now resolves both Express backends to patched `proxy-addr` 2.0.8. It also uses
patched `body-parser` 1.20.6/2.3.0 and `qs` 6.16.0, retaining each backend's
parser major version. A frozen-lockfile installation succeeded and the
production audit reported no known vulnerabilities after the update.

Runtime tests exercise the Express installations actually used by both
backends: IPv4 callers cannot claim a forwarded IP through short-prefix IPv6
trust ranges, legitimate loopback proxies still work, invalid parser limits
throw, valid JSON parses, and oversized bodies return HTTP 413.

Sources: [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h),
[body-parser advisory](https://github.com/advisories/GHSA-v422-hmwv-36x6),
[qs array-limit advisory](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), and
[qs isBuffer advisory](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).

## Release evidence

The local release command now includes frontend unit tests, operational script
tests, placement bundle freshness, renderer parsing, and icon shadowing checks.
It replaces stale passing evidence at startup and saves progress after each
stage. Failed API readiness and smoke checks produce a failed report; failures
throw through the API cleanup block instead of exiting before cleanup. Each
readiness request has a bounded timeout. Evidence records whether the working
tree was dirty and must not be described as verification of the commit alone.

Disposable upload-restart and Playwright runners explicitly select the test
deployment profile, preventing the invoking shell's deployment configuration
from leaking into their isolated databases and local storage. Startup tests
also select the logging level they need and launch Node directly, without an
`npx` shell wrapper or package download resolution.

Session-refresh browser tests select the actual navigation menu rather than
matching every link to the same page (the onboarding guide also links there).
Mobile recovery tests use the configured client portal origin, so they exercise
the client production bundle rather than a client path on the staff origin.
The staff invoice UI also hides voiding after a deposit, matching the API rule.

Verification uses a temporary PostgreSQL 18 cluster bound to loopback, with its
own data directory and port. The original database configuration was rejected
by PostgreSQL and was not modified. The isolated database needs its own inbound
lead organization; preflight intentionally rejects an unresolved organization.

## Final local verification

`pnpm run release:check` passed all 28 stages on 2026-10-09 in 8 minutes
24 seconds. The report records `worktreeDirty: true`; this verifies the current
working tree, not a clean checkout of commit `19dedf4`.

| Check | Result |
| --- | --- |
| Frontend unit tests | 322 passed |
| API unit/integration tests | 322 passed |
| Shared schema tests | 21 passed |
| Operational script tests | 13 passed |
| Authenticated workflow smoke | 74 checks passed |
| Chromium browser tests | 95 passed, including real backend workflows and the renderer benchmark |
| Migration paths | Empty database and interrupted historical upgrade passed; 22 ordered migrations |
| Backup/restore | 29 public tables verified |
| Upload persistence | Documents and encrypted attachments survived API restart with matching checksums |
| Builds and source checks | Lint, TypeScript, API/staff/client builds, bundle budgets, renderer and control checks passed |
| Production dependencies | No known vulnerabilities reported |

The mobile recovery browser cases deliberately intercept API responses for
failure injection. The separate three-role workflow uses the real production
backend and PostgreSQL. Email delivery is disabled during these checks. The
temporary database cluster was stopped and removed after verification.

## Launch evidence still required

- A clean checkout and successful remote CI run for the actual release commit.
- Production container startup, TLS, email delivery, and durable cloud storage.
- A configured monitoring provider and evidence that alerts reach the operator.
- Scheduled backups and a restore drill using the intended production services.
- Staging checks on representative devices and production-like data, including
  the remaining workspace edge cases in the readiness tracker.

Local test results and the final release-gate status are recorded in
`.release-evidence/production-hardening-release.log` and
`.release-evidence/release-check.json`. These generated files are not committed.
