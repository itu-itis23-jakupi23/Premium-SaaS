import { Router, type IRouter } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * Public lead intake ("Request a quote" on the marketing site).
 *
 * Fills the top of the sales funnel: a visitor's inquiry becomes a `lead`
 * client in the default organization, visible in the chief's CRM under the
 * existing "Lead" filter and in the activity feed. From there the existing
 * approve → assign-PM pipeline takes over.
 *
 * Defensive, because it is unauthenticated and public:
 *   - Rate limited per IP so it cannot be used to flood the CRM.
 *   - Every field is validated and length-capped.
 *   - De-duplicates by email so repeat submissions append to one record
 *     instead of spawning duplicate leads.
 */

const router: IRouter = Router();

async function queryRows<T>(statement: SQL): Promise<T[]> {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

// Per-process, per-IP window. Legitimate use is a handful of submissions.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && value.length <= 255;
}

router.post("/leads", async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: { code: "too_many_requests", message: "Please try again in a moment." } });
    return;
  }
  if (hits.size > 2000) {
    const now = Date.now();
    for (const [key, entry] of hits) if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) hits.delete(key);
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const companyName = clean(body.companyName, 200);
  const contactName = clean(body.contactName, 160);
  const contactEmail = clean(body.contactEmail, 255);

  if (!companyName || !contactName || !isEmail(contactEmail)) {
    res.status(400).json({
      error: { code: "invalid_lead", message: "Company, contact name, and a valid email are required." },
    });
    return;
  }

  const inquiry = {
    phone: clean(body.phone, 40),
    exhibitionName: clean(body.exhibitionName, 200),
    boothSize: clean(body.boothSize, 80),
    budget: clean(body.budget, 80),
    timeline: clean(body.timeline, 120),
    message: clean(body.message, 4000),
    submittedAt: new Date().toISOString(),
    source: "website",
  };

  try {
    const slug = process.env.DEFAULT_ORGANIZATION_SLUG?.trim();
    const orgRows = await queryRows<{ id: string }>(
      sql`select id::text from organizations where slug = ${slug} and deleted_at is null limit 1`,
    );
    const organizationId = orgRows[0]?.id;
    if (!organizationId) {
      res.status(503).json({ error: { code: "unavailable", message: "Lead intake is temporarily unavailable." } });
      return;
    }

    // De-dupe by email within the org: append to the existing record's history
    // rather than create a duplicate lead.
    const existing = await queryRows<{ id: string; metadata: Record<string, unknown> }>(sql`
      select id::text, metadata
      from clients
      where organization_id = ${organizationId}::uuid
        and lower(contact_email) = lower(${contactEmail})
        and deleted_at is null
      limit 1
    `);

    if (existing[0]) {
      const meta = existing[0].metadata ?? {};
      const history = Array.isArray((meta as Record<string, unknown>).leadIntakeHistory)
        ? ((meta as Record<string, unknown>).leadIntakeHistory as unknown[])
        : [];
      const nextMeta = { ...meta, leadIntake: inquiry, leadIntakeHistory: [...history, inquiry].slice(-20) };
      await db.execute(sql`
        update clients set metadata = ${JSON.stringify(nextMeta)}::jsonb, updated_at = now()
        where id = ${existing[0].id}::uuid
      `);
    } else {
      await db.execute(sql`
        insert into clients (organization_id, company_name, contact_name, contact_email, phone, status, lead_stage, lead_stage_changed_at, metadata)
        values (
          ${organizationId}::uuid, ${companyName}, ${contactName}, ${contactEmail},
          ${inquiry.phone || null}, 'lead', 'new', now(), ${JSON.stringify({ leadIntake: inquiry })}::jsonb
        )
      `);
    }

    await db
      .execute(sql`
        insert into activity_events (organization_id, actor_user_id, event_type, message, metadata)
        values (
          ${organizationId}::uuid, null, 'lead_created',
          ${`New quote request from ${companyName}`}, ${JSON.stringify({ contactEmail, inquiry })}::jsonb
        )
      `)
      .catch(() => undefined);

    logger.info({ organizationId, companyName, contactEmail }, "Website lead received");
    res.status(201).json({ ok: true });
  } catch (error) {
    logger.error({ err: error instanceof Error ? { message: error.message } : error }, "Lead intake failed");
    res.status(500).json({ error: { code: "lead_failed", message: "Could not submit your request. Please try again." } });
  }
});

export default router;
