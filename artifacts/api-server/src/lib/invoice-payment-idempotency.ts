import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { db } from "@workspace/db";
import type { AuthContext } from "../middlewares/session";

type Executor = Pick<typeof db, "execute">;
type PaymentOperation = "record-payment" | "mark-paid";
export interface PaymentResult { status: number; body: unknown; }
interface PaymentRequest { key: string; operation: PaymentOperation; fingerprint: string; }

export function parsePaymentRequest(key: string | undefined, operation: PaymentOperation, payload: unknown):
  { valid: true; request: PaymentRequest | null } | { valid: false } {
  // Existing integrations may omit a key. The application always supplies one.
  if (key === undefined) return { valid: true, request: null };
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(key)) return { valid: false };
  return {
    valid: true,
    request: { key, operation, fingerprint: createHash("sha256").update(JSON.stringify(payload)).digest("hex") },
  };
}

export async function lockPaymentRequest(executor: Executor, auth: AuthContext, request: PaymentRequest | null) {
  if (!request) return;
  // Keys belong to an organization and actor, across both payment operations
  // and all invoices. Lock the key before the invoice row so a concurrent reuse
  // on another invoice cannot reach the ledger before the first result commits.
  // Hash collisions only serialize otherwise independent requests.
  const lockId = createHash("sha256")
    .update(`invoice-payment:${auth.organization.id}:${auth.user.id}:${request.key}`)
    .digest().readBigInt64BE(0).toString();
  await executor.execute(sql`select pg_advisory_xact_lock(${lockId}::bigint)`);
}

export async function replayPaymentRequest(executor: Executor, auth: AuthContext, invoiceId: string, request: PaymentRequest | null): Promise<PaymentResult | null> {
  if (!request) return null;
  const result = await executor.execute(sql`
    select invoice_id::text as "invoiceId", operation, request_hash as "requestHash",
      response_status as "status", response_body as "body"
    from invoice_payment_requests
    where organization_id = ${auth.organization.id}::uuid and actor_user_id = ${auth.user.id}::uuid
      and request_key = ${request.key}
  `);
  const previous = (result as unknown as { rows: Array<{ invoiceId: string; operation: string; requestHash: string; status: number; body: unknown }> }).rows[0];
  if (!previous) return null;
  if (previous.invoiceId !== invoiceId || previous.operation !== request.operation || previous.requestHash !== request.fingerprint) {
    return { status: 409, body: { error: { code: "idempotency_conflict", message: "This payment request key was already used for a different request." } } };
  }
  return { status: previous.status, body: previous.body };
}

export async function savePaymentResult(executor: Executor, auth: AuthContext, invoiceId: string, request: PaymentRequest | null, result: PaymentResult) {
  if (!request) return;
  // The response, ledger, balance, and audit entry share one transaction.
  // Failures never consume a key, and a restart can replay the original result.
  await executor.execute(sql`
    insert into invoice_payment_requests
      (organization_id, actor_user_id, request_key, invoice_id, operation, request_hash, response_status, response_body)
    values (${auth.organization.id}::uuid, ${auth.user.id}::uuid, ${request.key}, ${invoiceId}::uuid,
      ${request.operation}, ${request.fingerprint}, ${result.status}, ${JSON.stringify(result.body)}::jsonb)
  `);
}
