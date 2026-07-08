import { Resend } from "resend";

const FROM = process.env.RESEND_FROM ?? "ENS Agency <onboarding@resend.dev>";
const APP_URL = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith("re_placeholder") || key === "your-resend-api-key-here") return null;
  _resend = new Resend(key);
  return _resend;
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

async function send(to: string, subject: string, html: string) {
  const resend = getResend();
  if (!resend) {
    // Log but don't throw — email is non-critical infrastructure.
    // The action (approval, invitation) has already succeeded server-side.
    console.info(`[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err);
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

export async function sendClientApprovedEmail(opts: { to: string; name: string }) {
  const loginUrl = `${APP_URL}/login`;
  await send(
    opts.to,
    "Your account has been approved — ENS Agency",
    base(`
      <h2>You're in!</h2>
      <p>Hi ${opts.name || "there"},</p>
      <p>Your account with <strong>ENS Agency</strong> has been reviewed and approved.
      You now have full access to your client portal.</p>
      <a href="${loginUrl}" class="cta">Open your portal</a>
      <div class="box">${loginUrl}</div>
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
  await send(
    opts.to,
    "You have been invited to ENS Agency Portal",
    base(`
      <h2>You've been invited</h2>
      <p>Hi ${opts.name || "there"},</p>
      <p>You have been invited to join the <strong>ENS Agency</strong> internal portal
      as a <strong>Project Manager</strong>.</p>
      <p>Your invitation link expires on <strong>${expiry}</strong>.</p>
      <a href="${fullUrl}" class="cta">Accept invitation</a>
      <div class="box">${fullUrl}</div>
    `),
  );
}

export async function sendRevisionRequestedEmail(opts: {
  to: string;
  pmName: string;
  projectName: string;
  workspaceUrl: string;
}) {
  await send(
    opts.to,
    `Revision requested on "${opts.projectName}"`,
    base(`
      <h2>Revision requested</h2>
      <p>Hi ${opts.pmName},</p>
      <p>Your client has requested a revision on the booth design for
      <strong>${opts.projectName}</strong>.</p>
      <a href="${opts.workspaceUrl}" class="cta">Open workspace</a>
    `),
  );
}

export async function sendDesignApprovedEmail(opts: {
  to: string;
  pmName: string;
  projectName: string;
  workspaceUrl: string;
}) {
  await send(
    opts.to,
    `Design approved: "${opts.projectName}"`,
    base(`
      <h2>Design approved!</h2>
      <p>Hi ${opts.pmName},</p>
      <p>Great news — your client has approved the final booth design for
      <strong>${opts.projectName}</strong>. The workspace is now locked.</p>
      <a href="${opts.workspaceUrl}" class="cta">View workspace</a>
    `),
  );
}

export async function sendPasswordResetEmail(opts: { to: string; name: string; resetUrl: string }) {
  await send(
    opts.to,
    "Reset your password — ENS Agency",
    base(`
      <h2>Reset your password</h2>
      <p>Hi ${opts.name || "there"},</p>
      <p>We received a request to reset the password for your ENS Agency account.
      Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${opts.resetUrl}" class="cta">Reset password</a>
      <div class="box">${opts.resetUrl}</div>
      <p style="margin-top:16px;font-size:13px;color:#9395a8">
        If you did not request a password reset, you can safely ignore this email.
        Your password will not change.
      </p>
    `),
  );
}
