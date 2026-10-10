# Account recovery and client management

Date: 2026-10-10

The manager's client drawer previously displayed the same demo password for
every client, asserted security settings it had never fetched, and showed and
sent sample billing amounts. It now displays the actual linked portal account
ID, contact information with a clear source, client-owned recovery guidance,
and invoice totals from the database.

## Client account and billing behavior

- Account information distinguishes a linked, active portal user from a contact
  without a linked account. Password, MFA and session assertions were removed.
  Existing users and their stored passwords were not reset or reseeded.
- Clipboard success follows the successful browser write. Denied or unavailable
  clipboard access displays an error and leaves the values readable. A failed
  status change retains the last confirmed status and displays an error.
- `GET /api/platform/invoices/summary?clientId=...` aggregates all visible issued
  invoices, including records beyond the invoice list's 200-row limit. Issued
  totals include open, paid and uncollectible invoices; drafts, void and deleted
  records are excluded. Only open invoices contribute to the outstanding balance.
  Different currencies remain separate. Organization, client and manager scope
  use the same authorization rules as invoice listing.
- Billing has explicit loading, empty, failure and retry states. Sharing sends a
  link to the client's current invoice page rather than an amount that may become
  outdated after a payment. Sharing requires a linked account, a usable client
  portal URL and at least one issued invoice.
- Workspace links use the client portal and `?project=`, which the client
  workspace actually reads. The shared destination helper validates configured
  HTTP/HTTPS URLs and supports a portal base path. Separate production staff
  builds require `VITE_CLIENT_APP_URL`; an absent configuration produces visible
  guidance instead of a guessed link. Local ports 5174 and 5175 resolve to the
  running separate portals. The production browser runner supplies its actual
  client origin during both builds.
- Account guidance and billing messages are translated across all eleven locales.

## Recovery and authentication integrity

Reset issuance and consumption lock the eligible user before token rows. Deleted
or disabled accounts cannot receive or redeem a reset. Issuance invalidates old
active links and inserts the new hashed token in one transaction; email dispatch
starts after commit. Public responses retain account-discovery protection.

Redemption consumes an unused, unexpired token, changes the password, invalidates
other active links and revokes all sessions in a single transaction. Expiry is
checked with `clock_timestamp()` after acquiring the user lock. Concurrent uses
of one link cannot both succeed, and any database write failure rolls back the
entire reset.

Session creation shares that user lock and rechecks the exact credential that
was verified. A login that verified an old password before a reset cannot create
a surviving session afterward. It also rechecks active membership and uses the
current membership role. Two-factor challenges bind the organization and an
opaque HMAC credential version; their version and expiry are rechecked after
database waits. In-flight challenges issued by an older build require signing
in again. Existing stored passwords remain valid until their owners change them.

Email sending recognizes Resend's resolved `{ data: null, error }` responses as
failures, rather than declaring success whenever the promise resolves. A missing
message acceptance ID also fails. Provider errors are sanitized before logging
or returning delivery metadata. A successful result means provider acceptance,
not proof of delivery to the recipient's inbox.

## Approval enforcement

Generic client-status changes lock the scoped client and check its current state.
Transitions into or out of pending approval return
`409 approval_workflow_required`; activation and rejection must use the Chief's
dedicated review endpoints. Allowed changes and their audit record commit
together. Same-state requests remain harmless no-ops.

## Verification

These results verify a dirty working tree based on commit
`81302e01b82aae3b9845f349cff19f73dceb4f80`, not a clean published release.

| Check | Result |
| --- | --- |
| API unit and integration suite | All 434 tests in 34 files passed |
| Frontend unit suite | All 371 tests in 29 files passed |
| Focused production browser suite | All 15 account-management and recovery cases passed; the seven manager cases passed again after the final focus-style change |
| TypeScript and lint | Passed across the workspace |
| Production builds | API, staff and client passed |
| Frontend bundle budgets | Passed; stylesheet gzip is 30,697 bytes against the client marketing limit of 30,720 |
| Secret scan | Passed across 909 repository files |
| Real-data browser flow | PM account identity and all EUR invoice totals matched API responses; the existing Sedef client signed in and restored its session after reload |

API regressions include concurrent reset redemption, a link expiring while
waiting for a lock, failed writes that roll back passwords/tokens/sessions,
stale-password login races, old and expired two-factor challenges, provider
rejections, pending-status races, tenant isolation and a 205-invoice summary.
The manager browser cases inject clipboard denial, failed status writes and a
failed summary followed by retry, and verify the actual outgoing client links.

The first full API run passed 433 of 434 cases. Its startup test depended on an
organization that an earlier suite had already deleted; with an empty database,
the server correctly permitted bootstrap startup. That test now owns and cleans
its own organization. Its seven-case retry and the complete 434-case rerun passed
with the original timeouts. The initial stylesheet exceeded its limit by 27 bytes.
The account controls now reuse existing visible focus-ring utilities and ordinary
text selection, removing redundant CSS without changing the limit. Both original
failures remain in the evidence directory.

Tests used separate disposable PostgreSQL databases, which were removed after
verification. The configured application database was not a test fixture.
Browser failure cases intercepted all API traffic; the real-data browser probe
blocked every API write except authentication. The API and both local portals
remain running.

Evidence under `.release-evidence`:

- `account-hardening-api-tests.log` and `account-hardening-initial-budget.json`
  preserve the initial failures.
- `account-hardening-startup-retry.log` and
  `account-hardening-final-api-tests.log` record the corrected tests.
- `account-hardening-production-browser.log` and
  `account-hardening-final-production-browser.log` record the production builds
  and focused browser runs.
- `account-hardening-final-static-checks.log`, `frontend-performance.json` and
  `current-app-client-management-browser.json` record static checks, budgets
  and the actual running application.

## Launch work still required

This round validates local source and production bundles. A published release,
remote CI, live email URLs and delivery, deployment infrastructure, monitoring,
scheduled backups and production restore drills remain separate launch checks.
Concurrent consumption of a two-factor backup code remains an authentication
follow-up. The Chief approval screen's explicit capacity-override confirmation
and delivery feedback also need a separate workflow review.
