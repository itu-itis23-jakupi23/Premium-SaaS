/**
 * /api/platform/managers/invitations  — full CRUD + email
 *
 * Routes
 *   POST   /api/platform/managers/invitations              create & email
 *   POST   /api/platform/managers/invitations/:id/resend   resend email
 *   DELETE /api/platform/managers/invitations/:id          revoke
 *   GET    /api/platform/managers/invitations/validate     validate token
 *   POST   /api/platform/managers/invitations/accept       accept invitation
 */
import { Router, type Request, type Response } from "express";
import crypto, { randomBytes, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";
import { invitations, type DBInvitation } from "../db.js";
import { sendInvitationEmail, sendResendInvitationEmail } from "../email.js";
import { readJsonStore, writeJsonStore } from "../storage.js";

const router = Router();
const scrypt = promisify(scryptCallback);

const APP_URL = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
const AUTH_STORE_KEY = "auth";

type StaffRole = "pm" | "chief";

interface StoredAuthUser {
  id: string;
  name: string;
  company: string;
  email: string;
  role: "chief" | "pm" | "client";
  systemRole: string;
  passwordHash: string;
  avatarUrl: string;
  avatarTone: string;
  createdAt: string;
}

interface AuthStore {
  users: StoredAuthUser[];
  sessions?: unknown[];
  loginAttempts?: unknown[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function inviteUrlFor(token: string): string {
  return `${APP_URL}/pm/join?token=${token}`;
}

function expiresAt(daysFromNow = 7): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString();
}

function toApiShape(row: DBInvitation) {
  return {
    id:        row.id,
    name:      row.name,
    email:     row.email,
    role:      row.role,
    token:     row.token,
    inviteUrl: row.invite_url,
    status:    row.status as "Pending" | "Accepted" | "Revoked" | "Expired",
    expiresAt: typeof row.expires_at === "string"
      ? row.expires_at
      : (row.expires_at as unknown as Date).toISOString(),
    createdAt: typeof row.created_at === "string"
      ? row.created_at
      : (row.created_at as unknown as Date).toISOString(),
  };
}

function isExpired(row: DBInvitation): boolean {
  const d = typeof row.expires_at === "string"
    ? new Date(row.expires_at)
    : (row.expires_at as unknown as Date);
  return d < new Date();
}

function normalizedInviteRole(role: string): StaffRole {
  return role === "chief" ? "chief" : "pm";
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function createStaffAuthAccount(row: DBInvitation, name: string, password: string) {
  const store = await readJsonStore<AuthStore>(AUTH_STORE_KEY, { users: [], sessions: [], loginAttempts: [] });
  store.users ??= [];
  store.sessions ??= [];
  store.loginAttempts ??= [];

  const email = row.email.trim().toLowerCase();
  if (store.users.some((user) => user.email.trim().toLowerCase() === email)) {
    return { ok: false as const, status: 409, error: "An account already exists for this invitation email." };
  }

  const role = normalizedInviteRole(row.role);
  const company = process.env.DEFAULT_AGENCY_NAME || process.env.DEFAULT_ORGANIZATION_NAME || "NIKA";
  const user: StoredAuthUser = {
    id: `user-${Date.now()}-${randomBytes(4).toString("hex")}`,
    name,
    company,
    email,
    role,
    systemRole: role === "chief" ? "owner" : "pm",
    passwordHash: await hashPassword(password),
    avatarUrl: "",
    avatarTone: role === "chief" ? "primary" : "blue",
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  await writeJsonStore(AUTH_STORE_KEY, store);
  return { ok: true as const, user };
}

// ── POST /api/platform/managers/invitations ──────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body as { name?: string; email?: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName  = (name ?? "").trim() || cleanEmail.split("@")[0];

    // Prevent duplicate pending invitations for the same email
    const existing = await invitations.findByEmail(cleanEmail);
    if (existing && existing.status === "Pending" && !isExpired(existing)) {
      return res.status(409).json({
        error: `A pending invitation already exists for ${cleanEmail}. Resend it instead.`,
      });
    }

    const token  = newToken();
    const url    = inviteUrlFor(token);
    const expiry = expiresAt(7);
    const now    = new Date().toISOString();
    const id     = `inv-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    await invitations.insert({
      id, name: cleanName, email: cleanEmail, role: "pm",
      token, invite_url: url, status: "Pending", expires_at: expiry, created_at: now,
    });

    // Send email — don't let email failure break the DB record
    let emailError: string | null = null;
    try {
      const result = await sendInvitationEmail({ to: cleanEmail, name: cleanName, inviteUrl: url, expiresAt: expiry });
      if ("error" in result && result.error) {
        emailError = result.error.message;
        console.error("[email] send failed:", result.error);
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Unknown email error";
      console.error("[email] send threw:", err);
    }

    const row = await invitations.findById(id);
    return res.status(201).json({
      invitation: toApiShape(row!),
      ...(emailError ? { emailWarning: emailError } : {}),
    });
  } catch (err) {
    console.error("[POST /invitations]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── POST /api/platform/managers/invitations/:id/resend ───────────────────────

router.post("/:id/resend", async (req: Request, res: Response) => {
  try {
    const row = await invitations.findById(String(req.params.id));
    if (!row)                      return res.status(404).json({ error: "Invitation not found." });
    if (row.status === "Revoked")  return res.status(400).json({ error: "This invitation has been revoked." });
    if (row.status === "Accepted") return res.status(400).json({ error: "This invitation has already been accepted." });

    // Issue a fresh token and extend expiry
    const token  = newToken();
    const url    = inviteUrlFor(token);
    const expiry = expiresAt(7);

    await invitations.updateTokenAndExpiry(token, url, expiry, row.id);

    let emailError: string | null = null;
    try {
      const result = await sendResendInvitationEmail({ to: row.email, name: row.name, inviteUrl: url, expiresAt: expiry });
      if ("error" in result && result.error) {
        emailError = result.error.message;
        console.error("[email] resend failed:", result.error);
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Unknown email error";
      console.error("[email] resend threw:", err);
    }

    const updated = await invitations.findById(row.id);
    return res.json({
      invitation: toApiShape(updated!),
      ...(emailError ? { emailWarning: emailError } : {}),
    });
  } catch (err) {
    console.error("[POST /invitations/:id/resend]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── DELETE /api/platform/managers/invitations/:id ────────────────────────────

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const row = await invitations.findById(String(req.params.id));
    if (!row) return res.status(404).json({ error: "Invitation not found." });

    await invitations.updateStatus("Revoked", row.id);

    const all = (await invitations.listAll()).map(toApiShape);
    return res.json({ ok: true, invitations: all });
  } catch (err) {
    console.error("[DELETE /invitations/:id]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── GET /api/platform/managers/invitations/validate?token=xxx ────────────────

router.get("/validate", async (req: Request, res: Response) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) return res.status(400).json({ error: "token is required." });

    const row = await invitations.findByToken(token);

    if (!row || row.status === "Revoked") {
      return res.status(404).json({ error: "This invitation link is invalid or has been revoked." });
    }
    if (row.status === "Accepted") {
      return res.status(409).json({ error: "This invitation has already been used to create an account." });
    }
    if (isExpired(row)) {
      await invitations.updateStatus("Expired", row.id);
      return res.status(410).json({ error: "This invitation link has expired. Ask your Chief Manager to resend it." });
    }

    return res.json({
      valid:     true,
      email:     row.email,
      name:      row.name || null,
      expiresAt: toApiShape(row).expiresAt,
      role:      row.role,
    });
  } catch (err) {
    console.error("[GET /invitations/validate]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ── POST /api/platform/managers/invitations/accept ───────────────────────────
// Called by the PMJoin registration form. In production, hash the password
// and create the manager auth account here.

router.post("/accept", async (req: Request, res: Response) => {
  try {
    const { token, name, password } = req.body as {
      token?: string; name?: string; password?: string;
    };

    if (!token || !password) {
      return res.status(400).json({ error: "token and password are required." });
    }
    if ((password?.length ?? 0) < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters and include one uppercase letter and one number." });
    }

    const row = await invitations.findByToken(token.trim());

    if (!row || row.status === "Revoked") {
      return res.status(404).json({ error: "Invalid or already used invitation link." });
    }
    if (row.status === "Accepted") {
      return res.status(409).json({ error: "This invitation has already been used." });
    }
    if (isExpired(row)) {
      await invitations.updateStatus("Expired", row.id);
      return res.status(410).json({ error: "This invitation link has expired." });
    }

    const displayName = (name ?? "").trim() || row.name;
    const account = await createStaffAuthAccount(row, displayName, password);
    if (!account.ok) {
      return res.status(account.status).json({ error: account.error });
    }
    await invitations.acceptInvitation(displayName, token.trim(), "Pending");

    return res.status(201).json({
      ok: true,
      user: {
        id: account.user.id,
        name: account.user.name,
        email: account.user.email,
        role: account.user.role,
        systemRole: account.user.systemRole,
      },
    });
  } catch (err) {
    console.error("[POST /invitations/accept]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
