/**
 * ENS Agency — PostgreSQL database layer (node-postgres)
 *
 * Connects via the DATABASE_URL environment variable — compatible with any
 * managed Postgres provider: Neon, Supabase, Railway, Render, AWS RDS, etc.
 *
 * The schema is created automatically on first start via initSchema().
 * Call it once from server/index.ts before the app starts accepting requests.
 */
import pg from "pg";

const { Pool } = pg;

// ── Connection pool ───────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  throw new Error(
    "\n DATABASE_URL is not set.\n" +
    " Add it to your .env.staff file.\n" +
    " Example: DATABASE_URL=postgresql://user:pass@localhost:5432/ens_agency\n"
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // In production most managed providers (Neon, Supabase, Railway) require SSL.
  // Set DATABASE_SSL=false to disable (e.g. local Docker Postgres).
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  max: 20,                    // max pool connections (suitable for 10k users)
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[db] Idle client error:", err.message);
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DBInvitation {
  id: string;
  name: string;
  email: string;
  role: string;
  token: string;
  invite_url: string;
  status: string;
  expires_at: string;
  created_at: string;
}

// ── Schema migration ──────────────────────────────────────────────────────────
// Safe to run on every start — all statements use IF NOT EXISTS.

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS manager_invitations (
      id         TEXT        PRIMARY KEY,
      name       TEXT        NOT NULL,
      email      TEXT        NOT NULL,
      role       TEXT        NOT NULL DEFAULT 'pm',
      token      TEXT        NOT NULL UNIQUE,
      invite_url TEXT        NOT NULL,
      status     TEXT        NOT NULL DEFAULT 'Pending',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_invitations_email  ON manager_invitations (email);
    CREATE INDEX IF NOT EXISTS idx_invitations_token  ON manager_invitations (token);
    CREATE INDEX IF NOT EXISTS idx_invitations_status ON manager_invitations (status);

    CREATE TABLE IF NOT EXISTS managers (
      id            TEXT        PRIMARY KEY,
      name          TEXT        NOT NULL,
      email         TEXT        NOT NULL UNIQUE,
      role          TEXT        NOT NULL DEFAULT 'pm',
      password_hash TEXT        NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("[db] Schema ready");
}

// ── Query helpers ─────────────────────────────────────────────────────────────
// Thin wrappers — keep SQL close to the call sites while staying type-safe.

export const invitations = {

  async insert(data: {
    id: string;
    name: string;
    email: string;
    role: string;
    token: string;
    invite_url: string;
    status: string;
    expires_at: string;
    created_at: string;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO manager_invitations
         (id, name, email, role, token, invite_url, status, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.id, data.name, data.email, data.role,
        data.token, data.invite_url, data.status,
        data.expires_at, data.created_at,
      ],
    );
  },

  async findById(id: string): Promise<DBInvitation | null> {
    const { rows } = await pool.query<DBInvitation>(
      `SELECT * FROM manager_invitations WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async findByToken(token: string): Promise<DBInvitation | null> {
    const { rows } = await pool.query<DBInvitation>(
      `SELECT * FROM manager_invitations WHERE token = $1`,
      [token],
    );
    return rows[0] ?? null;
  },

  async findByEmail(email: string): Promise<DBInvitation | null> {
    const { rows } = await pool.query<DBInvitation>(
      `SELECT * FROM manager_invitations WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  },

  async listAll(): Promise<DBInvitation[]> {
    const { rows } = await pool.query<DBInvitation>(
      `SELECT * FROM manager_invitations ORDER BY created_at DESC`,
    );
    return rows;
  },

  async listPending(): Promise<DBInvitation[]> {
    const { rows } = await pool.query<DBInvitation>(
      `SELECT * FROM manager_invitations WHERE status = 'Pending' ORDER BY created_at DESC`,
    );
    return rows;
  },

  async updateStatus(status: string, id: string): Promise<void> {
    await pool.query(
      `UPDATE manager_invitations SET status = $1 WHERE id = $2`,
      [status, id],
    );
  },

  async updateTokenAndExpiry(
    token: string,
    inviteUrl: string,
    expiresAt: string,
    id: string,
  ): Promise<void> {
    await pool.query(
      `UPDATE manager_invitations
          SET token = $1, invite_url = $2, expires_at = $3, status = 'Pending'
        WHERE id = $4`,
      [token, inviteUrl, expiresAt, id],
    );
  },

  async acceptInvitation(name: string, token: string, expectedStatus: string): Promise<void> {
    await pool.query(
      `UPDATE manager_invitations
          SET name = $1, status = 'Accepted'
        WHERE token = $2 AND status = $3`,
      [name, token, expectedStatus],
    );
  },

};
