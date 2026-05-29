/**
 * Email sending via Resend (https://resend.com).
 * Free tier: 3 000 emails / month — plenty for an internal PM portal.
 *
 * Sign up → get an API key → add RESEND_API_KEY to your .env.staff file.
 * Set RESEND_FROM to your verified sender address (e.g. "ENS Agency <no-reply@ens-agency.com>").
 */
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

const FROM    = process.env.RESEND_FROM ?? "ENS Agency <onboarding@resend.dev>";
const APP_URL = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

// ── Templates ────────────────────────────────────────────────────────────────

function baseLayout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ENS Agency</title>
  <style>
    body { margin:0; padding:0; background:#0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width:560px; margin:40px auto; background:#1a1d27; border:1px solid #2a2d3a; border-radius:12px; overflow:hidden; }
    .header  { background:#131623; padding:28px 32px; border-bottom:1px solid #2a2d3a; }
    .logo    { font-size:20px; font-weight:700; color:#e2e4ef; letter-spacing:0.04em; }
    .logo span { color:#6366f1; }
    .body    { padding:32px; color:#c8cadc; font-size:15px; line-height:1.6; }
    .body p  { margin:0 0 16px; }
    .cta     { display:inline-block; margin:8px 0 24px; padding:13px 28px; background:#6366f1; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; }
    .box     { background:#131623; border:1px solid #2a2d3a; border-radius:8px; padding:16px 20px; margin:20px 0; font-size:13px; color:#9395a8; word-break:break-all; }
    .footer  { padding:20px 32px; border-top:1px solid #2a2d3a; font-size:12px; color:#555770; }
    h2       { margin:0 0 20px; font-size:22px; font-weight:700; color:#e2e4ef; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">ENS<span>.</span>Agency</div>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      This email was sent by ENS Agency internal portal.
      If you did not expect this, you can safely ignore it.
    </div>
  </div>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendInvitationEmail(opts: {
  to: string;
  name: string;
  inviteUrl: string;
  expiresAt: string;
}) {
  const { to, name, inviteUrl, expiresAt } = opts;
  const fullUrl    = inviteUrl.startsWith("http") ? inviteUrl : `${APP_URL}${inviteUrl}`;
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const html = baseLayout(`
    <h2>You have been invited</h2>
    <p>Hi ${name || "there"},</p>
    <p>
      You have been invited to join the <strong>ENS Agency</strong> internal portal
      as a <strong>Project Manager</strong>.
    </p>
    <p>Click the button below to set up your account. The link expires on <strong>${expiryDate}</strong>.</p>
    <a href="${fullUrl}" class="cta">Accept invitation</a>
    <p style="font-size:13px; color:#555770;">Or copy this link into your browser:</p>
    <div class="box">${fullUrl}</div>
    <p style="font-size:13px; color:#555770; margin:0;">If you have questions, contact your Chief Manager.</p>
  `);

  return resend.emails.send({
    from: FROM,
    to,
    subject: "You have been invited to ENS Agency Portal",
    html,
  });
}

export async function sendResendInvitationEmail(opts: {
  to: string;
  name: string;
  inviteUrl: string;
  expiresAt: string;
}) {
  const { to, name, inviteUrl, expiresAt } = opts;
  const fullUrl    = inviteUrl.startsWith("http") ? inviteUrl : `${APP_URL}${inviteUrl}`;
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const html = baseLayout(`
    <h2>Invitation reminder</h2>
    <p>Hi ${name || "there"},</p>
    <p>
      This is a reminder that you have a pending invitation to join the
      <strong>ENS Agency</strong> portal as a <strong>Project Manager</strong>.
    </p>
    <p>Your new invitation link expires on <strong>${expiryDate}</strong>.</p>
    <a href="${fullUrl}" class="cta">Accept invitation</a>
    <div class="box">${fullUrl}</div>
  `);

  return resend.emails.send({
    from: FROM,
    to,
    subject: "Reminder: Your ENS Agency invitation is waiting",
    html,
  });
}
