import { Resend } from "resend";

const FROM = process.env.RESEND_FROM ?? "ENS Agency <onboarding@resend.dev>";
const APP_URL = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

let _resend: Resend | null = null;

export type EmailDeliveryResult =
  | { ok: true; status: "sent" }
  | { ok: false; status: "skipped" | "failed"; error: string };

function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith("re_placeholder") || key === "your-resend-api-key-here") return null;
  _resend = new Resend(key);
  return _resend;
}

/**
 * Escape a value being dropped into email HTML.
 *
 * Every template interpolated names and project titles raw. Those are
 * user-controlled: a client sets their own contact name, a PM names a project.
 * So a project called `<a href="https://evil.example">Reset your password</a>`
 * rendered as a working link inside a genuine mail from this platform, sent to
 * somebody else - content spoofing and a credible phishing vector, even though
 * mail clients strip <script>.
 *
 * Applied to text content. `&` goes first or it would double-escape the
 * entities the later replacements introduce.
 */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape a URL for an `href`, and refuse one that is not http(s).
 *
 * Attribute context needs the quote escaped, which `esc` does, but a URL also
 * needs its scheme checked: these are built from `APP_URL` and from an
 * `inviteUrl` passed in by a caller, and a `javascript:` or `data:` value in
 * either would be a live link in the recipient's mail client. An unusable
 * scheme becomes "#" rather than throwing - a broken button is better than a
 * password reset that never arrives.
 */
export function escUrl(value: string): string {
  const raw = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) {
    console.error(`[email] refusing to link a non-http(s) url: ${raw.slice(0, 80)}`);
    return "#";
  }
  return esc(raw);
}

function base(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<style>
  body{margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .w{max-width:560px;margin:40px auto;background:#1a1d27;border:1px solid #2a2d3a;border-radius:12px;overflow:hidden}
  .h{background:#131623;padding:28px 32px;border-bottom:1px solid #2a2d3a}
  .logo{font-size:20px;font-weight:700;color:#e2e4ef;letter-spacing:.04em}.logo span{color:#6366f1}
  .b{padding:32px;color:#c8cadc;font-size:15px;line-height:1.6}.b p{margin:0 0 16px}
  .cta{display:inline-block;margin:8px 0 24px;padding:13px 28px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}
  .box{background:#131623;border:1px solid #2a2d3a;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:13px;color:#9395a8;word-break:break-all}
  .f{padding:20px 32px;border-top:1px solid #2a2d3a;font-size:12px;color:#555770}
  h2{margin:0 0 20px;font-size:22px;font-weight:700;color:#e2e4ef}
</style></head><body>
  <div class="w">
    <div class="h"><div class="logo">ENS<span>.</span>Agency</div></div>
    <div class="b">${body}</div>
    <div class="f">Sent by ENS Agency portal. If you didn't expect this, you can safely ignore it.</div>
  </div>
</body></html>`;
}

/**
 * An address in a form safe to write to a log.
 *
 * Every delivery log line carried the full recipient address, which puts
 * personal data in application logs and log aggregation - the kind of thing a
 * data review flags, and this product ships across the EU. The domain and the
 * first character are enough to tell "the whole run went to the wrong domain"
 * from "one address bounced", which is what these lines are read for.
 */
export function redactAddress(address: string): string {
  const at = address.lastIndexOf("@");
  if (at <= 0) return "[redacted]";
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  return `${local[0]}***@${domain}`;
}

async function send(to: string, subject: string, html: string): Promise<EmailDeliveryResult> {
  const resend = getResend();
  if (!resend) {
    console.info(`[email] RESEND_API_KEY not set - skipping email to ${redactAddress(to)}: "${subject}"`);
    return { ok: false, status: "skipped", error: "RESEND_API_KEY is not configured" };
  }

  try {
    // The SDK resolves provider and network failures as { data: null, error }.
    // A fulfilled promise alone does not mean the provider accepted the mail.
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    if (result?.error) {
      const message = safeErrorMessage(result.error.message);
      console.error(`[email] Failed to send to ${redactAddress(to)}:`, message);
      return { ok: false, status: "failed", error: message };
    }
    if (typeof result?.data?.id !== "string" || !result.data.id.trim()) {
      const message = "Email provider did not confirm message acceptance";
      console.error(`[email] Failed to send to ${redactAddress(to)}:`, message);
      return { ok: false, status: "failed", error: message };
    }
    return { ok: true, status: "sent" };
  } catch (err) {
    const message = safeErrorMessage(err);
    console.error(`[email] Failed to send to ${redactAddress(to)}:`, message);
    return { ok: false, status: "failed", error: message };
  }
}

function safeErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/re_[A-Za-z0-9_\-=]+/g, "[redacted]")
    .replace(/sk_[A-Za-z0-9_\-=]+/g, "[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 500);
}

export async function sendReviewReminderEmail(opts: {
  to: string;
  name: string;
  projectName: string;
  daysWaiting: number;
}) {
  const workspaceUrl = `${APP_URL}/client/workspace`;
  return send(
    opts.to,
    `Your booth design is waiting for review - ${opts.projectName}`,
    base(`
      <h2>Your design is ready for review</h2>
      <p>Hi ${esc(opts.name) || "there"},</p>
      <p>The booth design for <strong>${esc(opts.projectName)}</strong> has been waiting
      for your review for ${esc(opts.daysWaiting)} day${opts.daysWaiting === 1 ? "" : "s"}.
      Approving it (or requesting changes) keeps your production schedule on track.</p>
      <a href="${escUrl(workspaceUrl)}" class="cta">Review the design</a>
      <div class="box">${esc(workspaceUrl)}</div>
    `),
  );
}

export async function sendClientApprovedEmail(opts: { to: string; name: string }) {
  const loginUrl = `${APP_URL}/login`;
  return send(
    opts.to,
    "Your account has been approved - ENS Agency",
    base(`
      <h2>You're in!</h2>
      <p>Hi ${esc(opts.name) || "there"},</p>
      <p>Your account with <strong>ENS Agency</strong> has been reviewed and approved.
      You now have full access to your client portal.</p>
      <a href="${escUrl(loginUrl)}" class="cta">Open your portal</a>
      <div class="box">${esc(loginUrl)}</div>
    `),
  );
}

export async function sendManagerInvitationEmail(opts: {
  to: string;
  name: string;
  inviteUrl: string;
  expiresAt: string;
}) {
  const fullUrl = opts.inviteUrl.startsWith("http") ? opts.inviteUrl : `${APP_URL}${opts.inviteUrl}`;
  const expiry = new Date(opts.expiresAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  return send(
    opts.to,
    "You have been invited to ENS Agency Portal",
    base(`
      <h2>You've been invited</h2>
      <p>Hi ${esc(opts.name) || "there"},</p>
      <p>You have been invited to join the <strong>ENS Agency</strong> internal portal
      as a <strong>Project Manager</strong>.</p>
      <p>Your invitation link expires on <strong>${esc(expiry)}</strong>.</p>
      <a href="${escUrl(fullUrl)}" class="cta">Accept invitation</a>
      <div class="box">${esc(fullUrl)}</div>
    `),
  );
}

export async function sendRevisionRequestedEmail(opts: {
  to: string;
  pmName: string;
  projectName: string;
  workspaceUrl: string;
}) {
  return send(
    opts.to,
    `Revision requested on "${opts.projectName}"`,
    base(`
      <h2>Revision requested</h2>
      <p>Hi ${esc(opts.pmName)},</p>
      <p>Your client has requested a revision on the booth design for
      <strong>${esc(opts.projectName)}</strong>.</p>
      <a href="${escUrl(opts.workspaceUrl)}" class="cta">Open workspace</a>
    `),
  );
}

export async function sendDesignApprovedEmail(opts: {
  to: string;
  pmName: string;
  projectName: string;
  workspaceUrl: string;
}) {
  return send(
    opts.to,
    `Design approved: "${opts.projectName}"`,
    base(`
      <h2>Design approved!</h2>
      <p>Hi ${esc(opts.pmName)},</p>
      <p>Great news - your client has approved the final booth design for
      <strong>${esc(opts.projectName)}</strong>. The workspace is now locked.</p>
      <a href="${escUrl(opts.workspaceUrl)}" class="cta">View workspace</a>
    `),
  );
}

export async function sendPasswordResetEmail(opts: { to: string; name: string; resetUrl: string }) {
  return send(
    opts.to,
    "Reset your password - ENS Agency",
    base(`
      <h2>Reset your password</h2>
      <p>Hi ${esc(opts.name) || "there"},</p>
      <p>We received a request to reset the password for your ENS Agency account.
      Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${escUrl(opts.resetUrl)}" class="cta">Reset password</a>
      <div class="box">${esc(opts.resetUrl)}</div>
      <p style="margin-top:16px;font-size:13px;color:#9395a8">
        If you did not request a password reset, you can safely ignore this email.
        Your password will not change.
      </p>
    `),
  );
}

/**
 * Cents to a readable amount for an email body.
 *
 * Deliberately plain rather than Intl-locale-aware: these go to an inbox, not
 * a rendered page, and the recipient's locale is not known here. The currency
 * code is spelled out so "1,250.00 EUR" cannot be mistaken for dollars.
 */
export function moneyLabel(cents: number, currency: string): string {
  const amount = (Number(cents) || 0) / 100;
  const code = (currency || "USD").toUpperCase();
  return `${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`;
}

/** A date for an email body, or null when there is none to show. */
export function dateLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export async function sendExtrasListEmail(opts: {
  to: string;
  name: string;
  show: string;
  stands: number;
  pieces: number;
  itemTypes: number;
  sentBy: string;
  lines: Array<{ sku: string; name: string; qty: number }>;
}) {
  const extrasUrl = `${APP_URL}/chief/extras`;
  // The pull list is the point of the mail: a chief who has to open a browser
  // to see what is leaving the warehouse will not check it. Long shows are
  // truncated rather than sent as a hundred-row table nobody scrolls.
  const shown = opts.lines.slice(0, 40);
  const remainder = opts.lines.length - shown.length;

  return send(
    opts.to,
    `Furniture lists for ${opts.show}`,
    base(`
      <h2>Furniture lists for ${esc(opts.show)}</h2>
      <p>Hi ${esc(opts.name) || "there"},</p>
      <p>${esc(opts.sentBy)} sent you the furniture lists for <strong>${esc(opts.show)}</strong>:
        <strong>${esc(opts.stands)}</strong> stands, <strong>${esc(opts.itemTypes)}</strong> item types,
        <strong>${esc(opts.pieces)}</strong> pieces in total.</p>
      <h3>Warehouse pull list</h3>
      <table style="border-collapse:collapse;font-size:14px">
        ${shown
          .map(
            (line) => `<tr>
              <td style="padding:2px 10px 2px 0">${esc(line.sku) || "-"}</td>
              <td style="padding:2px 10px 2px 0">${esc(line.name)}</td>
              <td style="padding:2px 0;text-align:right"><strong>${esc(line.qty)}</strong></td>
            </tr>`,
          )
          .join("")}
      </table>
      ${remainder > 0 ? `<p>and ${esc(remainder)} more lines.</p>` : ""}
      <p>The per-stand breakdown, and a printable version of both, are on the Extras page.</p>
      <a href="${escUrl(extrasUrl)}" class="cta">Open the furniture lists</a>
      <div class="box">${esc(extrasUrl)}</div>
    `),
  );
}

export async function sendQuoteReadyEmail(opts: {
  to: string;
  name: string;
  quoteNumber: string;
  projectName: string | null;
  totalLabel: string;
  validUntil: string | null;
}) {
  const quotesUrl = `${APP_URL}/client/quotes`;
  const subjectProject = opts.projectName ? ` - ${opts.projectName}` : "";
  return send(
    opts.to,
    `Your quote ${opts.quoteNumber} is ready${subjectProject}`,
    base(`
      <h2>Your quote is ready</h2>
      <p>Hi ${esc(opts.name) || "there"},</p>
      <p>Quote <strong>${esc(opts.quoteNumber)}</strong>${
        opts.projectName ? ` for <strong>${esc(opts.projectName)}</strong>` : ""
      } is ready for you, totalling <strong>${esc(opts.totalLabel)}</strong>.</p>
      ${
        opts.validUntil
          ? `<p>It is valid until <strong>${esc(opts.validUntil)}</strong>.</p>`
          : ""
      }
      <p>You can review the line items and accept or decline it in your portal.</p>
      <a href="${escUrl(quotesUrl)}" class="cta">Review the quote</a>
      <div class="box">${esc(quotesUrl)}</div>
    `),
  );
}

export async function sendInvoiceIssuedEmail(opts: {
  to: string;
  name: string;
  invoiceNumber: string;
  totalLabel: string;
  dueAt: string | null;
}) {
  const invoicesUrl = `${APP_URL}/client/invoices`;
  return send(
    opts.to,
    `Invoice ${opts.invoiceNumber} from ENS Agency`,
    base(`
      <h2>You have a new invoice</h2>
      <p>Hi ${esc(opts.name) || "there"},</p>
      <p>Invoice <strong>${esc(opts.invoiceNumber)}</strong> has been issued for
      <strong>${esc(opts.totalLabel)}</strong>.</p>
      ${opts.dueAt ? `<p>Payment is due by <strong>${esc(opts.dueAt)}</strong>.</p>` : ""}
      <a href="${escUrl(invoicesUrl)}" class="cta">View the invoice</a>
      <div class="box">${esc(invoicesUrl)}</div>
    `),
  );
}

export async function sendPaymentReceivedEmail(opts: {
  to: string;
  name: string;
  invoiceNumber: string;
  amountLabel: string;
  remainingLabel: string | null;
}) {
  const invoicesUrl = `${APP_URL}/client/invoices`;
  return send(
    opts.to,
    `Payment received - invoice ${opts.invoiceNumber}`,
    base(`
      <h2>Thank you - payment received</h2>
      <p>Hi ${esc(opts.name) || "there"},</p>
      <p>We have recorded a payment of <strong>${esc(opts.amountLabel)}</strong>
      against invoice <strong>${esc(opts.invoiceNumber)}</strong>.</p>
      ${
        opts.remainingLabel
          ? `<p><strong>${esc(opts.remainingLabel)}</strong> remains outstanding on this invoice.</p>`
          : "<p>This invoice is now settled in full.</p>"
      }
      <a href="${escUrl(invoicesUrl)}" class="cta">See your invoices</a>
      <div class="box">${esc(invoicesUrl)}</div>
    `),
  );
}
