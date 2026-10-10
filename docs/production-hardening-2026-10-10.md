# Payment recovery and invoice access hardening

Date: 2026-10-10

Staff can review and record a receipt, lose the response, and recover the original
result without writing another payment. A pending submission survives closing the
dialog and reloading the same browser tab.

## Changes

- Both payment endpoints support `Idempotency-Key`. Successful response status
  and JSON are saved in the same PostgreSQL transaction as the payment ledger,
  invoice balance, and audit event. Only committed successes consume keys.
- Keys belong to an organization and authenticated actor, across invoices and
  both payment operations. A transaction advisory lock serializes concurrent use
  of a key; the existing invoice row lock still prevents overpayments and races
  with voiding. Reusing a key for different normalized payment details, an
  invoice, or an operation returns `409 idempotency_conflict`.
- Replay checks current invoice authorization before returning the original
  response, even when subsequent payments have already settled the invoice.
- The application always sends the original actor and organization in
  `X-Payment-Actor-Id` and `X-Payment-Organization`. The backend rejects an
  account mismatch before applying a mutation. This prevents another tab's
  account change from moving an uncertain payment into a different actor's
  key namespace.
- Full-balance confirmation includes `expectedAmountCents`. If another receipt
  changed the balance after review, the server rejects the outdated confirmation
  without consuming its key.
- Managers can read an invoice's detail only within their assigned scope,
  matching the existing invoice list and payment-history rules.
- A labeled payment dialog replaces native prompts and immediate full-payment
  actions. It shows the amount and currency, accepts a method, reference and
  note, validates decimal amounts without rounding, and distinguishes recording
  a received payment from charging a card or transferring funds.
- Closing the dialog restores keyboard focus to its opening button, with the
  invoice heading as a fallback when settlement removes the button or recovery
  opens automatically after reloading.
- Exact submitted details and account identity are stored before sending. After
  an uncertain failure they stay locked for retry. Authentication, permission,
  visibility, account-change and conflict errors preserve the pending request.
  Only explicit business rejections reached after the saved-success lookup
  permit a corrected new submission.
- Confirmed payment success updates the invoice immediately. A later list
  refresh failure has a separate visible retry and cannot masquerade as a failed
  payment. Pending-request storage failures stop a new submission. Recovery
  storage clears only when its current request key matches the completed
  request, so an old response cannot erase a newer pending receipt.
- Payment instructions and recovery copy are available in all eleven locales.
- Static GLB shadows are reused during camera movement. Model addition, removal,
  placement or dimensions, booth geometry, lighting changes, canvas resizing and
  restored WebGL contexts request a fresh shadow pass. The renderer performance
  check retains its 1,500 ms warm-update budget on a four-times-throttled CPU.

## API and deployment contract

Apply migration `0022_invoice_payment_requests` before releasing the backend.
It adds durable response storage without changing existing ledger entries.

External callers should send a fresh, unpredictable `Idempotency-Key` for each
new receipt and retain it, together with the exact submitted details, until the
outcome is known. Keys contain 8 to 128 ASCII letters, numbers, underscores or
hyphens. Bank references are ordinary receipt data and do not deduplicate
payments. Distinct keys may legitimately record equal receipts.

For compatibility, existing integrations may omit the key and account headers;
such calls do not gain retry deduplication or account binding. The staff
application requires all three headers through its typed payment helpers.
Keys have no automatic expiry. Successful replay returns the historical response
snapshot; callers can fetch current invoice detail separately.

The optional full-payment `expectedAmountCents` is an integer number of cents.
New staff submissions always include the reviewed amount. A conflict needs fresh
invoice review, not automatic submission with a new key.

## Verification

Focused invoice, authorization and concurrency tests passed before the complete
release check. Additional checks cover normalized default-field replay,
cross-invoice key races, account changes, and database failures while writing
either the financial audit or the saved response. Both failures roll back all
financial changes and leave the original key reusable.

The production API restart check passed: deposit and settlement responses replay
with their original statuses and JSON, including a deposit replay after the
invoice has settled, and the ledger remains exactly two receipts. Document and
encrypted message attachment checksums also survive the restart.

Seven new Chromium scenarios use real authenticated production API requests and a
disposable PostgreSQL database. Lost-response scenarios commit through
`route.fetch()` before aborting only the browser response. They exercise deposit
retry, settled-invoice recovery after reload, retained receipt details, account
switching, changed full-balance confirmation, invalid monetary input, and a
confirmed receipt followed by a failed invoice-list refresh.

The first complete release run caught an existing renderer budget failure
(1,614.8 ms for a warm update with 100 models) and a recovery-test heading selector
that did not include the heading's help button. The payment recovery itself
completed. The renderer now caches static shadows, and the selector accepts the
actual accessible heading. The failed run and its performance measurements are
retained in `.release-evidence/payment-reliability-first-release-check.json` and
`.release-evidence/payment-reliability-first-workspace-performance.json`.

A later run exposed repeated English-file reads inside the locale placeholder
check. Its catalogue is now read once, and comparisons also detect translations
that drop every placeholder. All 42 locale checks passed with 518 ms of test
execution after the change; neither their timeout nor the renderer budget was
increased. A lint failure in a concurrently added email test was also corrected.

The latest full release attempt stopped at the required dependency audit because
the npm security endpoint returned DNS errors and then timed out. A direct retry
with network access enabled also timed out. The first run's production audit had
reported zero vulnerabilities; the latest attempt is still recorded as failed,
and the audit has not been skipped or weakened.

Current checks across this round:

| Check | Result |
| --- | --- |
| Lint and TypeScript | Passed, including the final focus-restoration changes |
| Frontend unit tests | 356 passed |
| API unit tests | 355 passed, including 18 payment idempotency cases |
| Shared schema and script unit tests | 21 and 13 passed in the first release run |
| Secret scan | Passed across 893 repository files |
| Fresh and interrupted-upgrade migrations | All 23 passed in the first release run |
| Backup restore | All 30 public tables matched in the first release run |
| Production workflow smoke | 74 checks passed in the first release run |
| API restart and payment replay | Passed with exactly two receipts |
| Production API, staff and client builds | Passed |
| Chromium against the real API | All 102 passed, including seven payment recovery scenarios and keyboard focus assertions |
| Frontend bundle budgets and UI checks | Passed; 534 interactive controls checked |
| Throttled renderer benchmark | Passed with unchanged 15-second cold and 1,500 ms warm limits |

The final browser suite took 7.5 minutes. At four-times CPU throttling, the
100-model scene's worst warm update was 1,488 ms and its cold load was 12,697.8 ms
at 1.6 million pixels. All five camera samples reused the shadow pass; dimension
edits, lighting changes and removal refreshed it. The warm result is close to
the limit, so this is a severe-stall guard rather than a real-device frame-rate
claim. Large-scene draw-call reduction and real-device measurements remain
performance follow-ups.

The complete gate evidence is `.release-evidence/release-check.json`; the latest
gate log is `.release-evidence/payment-reliability-release.log`. Separate checks
after the network failure are recorded in
`.release-evidence/payment-reliability-followup-checks.json`, with their API and
browser logs alongside it. Earlier failures are retained rather than overwritten
as successful evidence.

## Remaining launch checks

This round verifies local production bundles and disposable infrastructure.
It does not verify a clean published commit, remote CI, a live staging deployment,
production email delivery, cloud storage, monitoring alerts, scheduled backup
jobs, or a restore from the production database. Those operational checks remain
necessary before launch.

Pending recovery uses session storage in the same browser tab. Closing that tab
or moving to another browser requires checking invoice history before recording
another receipt. Successful response snapshots contain payment history, so
storage growth should be measured before supporting unusually large installment
counts. Refunds and credit notes remain separate future workflows.

Verification uses an isolated temporary PostgreSQL cluster. The configured
application database and its data are unchanged.
The temporary cluster was stopped and removed after validation; the existing
PostgreSQL Windows service remains running.
