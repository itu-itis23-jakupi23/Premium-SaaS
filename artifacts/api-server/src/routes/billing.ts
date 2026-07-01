import { sql } from "drizzle-orm";
import express, { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { db } from "@workspace/db";
import { requireAuth, requireRoles } from "../middlewares/session";
import { requireTenant } from "../middlewares/tenant";

const router = Router();

// ── Stripe client factory (lazy — only initialises if key is set) ─────────────

let _stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
  return _stripe;
}

const PLAN_PRICES: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  unlimited: process.env.STRIPE_PRICE_UNLIMITED,
};

const PLAN_EXTRA_ROUNDS: Record<string, number> = {
  starter: 3,
  pro: 8,
  unlimited: 0,
};

// ── Checkout session ──────────────────────────────────────────────────────────

router.post(
  "/platform/projects/:projectId/workspace/subscription-request",
  requireAuth,
  requireTenant,
  requireRoles(["client", "admin", "owner", "chief"]),
  async (req: Request, res: Response) => {
    const auth = req.auth!;
    const organization = req.tenant!;
    const projectId = typeof req.params.projectId === "string" ? req.params.projectId : req.params.projectId[0] ?? "";
    const plan = typeof req.body?.plan === "string" ? req.body.plan : "";

    if (!["starter", "pro", "unlimited"].includes(plan)) {
      res.status(400).json({ error: "A valid plan (starter, pro, unlimited) is required" });
      return;
    }

    const accessRows = await queryRows<{
      clientId: string;
      subscriptionActive: boolean;
      clientEmail: string;
      clientName: string;
    }>(sql`
      select
        c.id::text as "clientId",
        c.workspace_editor_subscription_active as "subscriptionActive",
        c.contact_email as "clientEmail",
        c.company_name as "clientName"
      from projects p
      join clients c on c.id = p.client_id
      where p.id = ${projectId}::uuid
        and p.organization_id = ${organization.id}::uuid
        and p.deleted_at is null
      limit 1
    `);

    const access = accessRows[0];
    if (!access) {
      res.status(404).json({ error: { code: "project_not_found", message: "Project not found" } });
      return;
    }

    if (access.subscriptionActive) {
      res.status(200).json({ message: "Unlimited access is already active.", already_active: true });
      return;
    }

    const stripe = getStripe();

    if (!stripe) {
      // Simulation fallback for dev/staging when STRIPE_SECRET_KEY is not set
      const paymentReference = `WSP-${projectId}-${Date.now()}-${plan.toUpperCase()}`;
      await db.execute(sql`
        update clients
        set
          workspace_editor_subscription_status = 'pending',
          workspace_editor_subscription_plan = ${plan},
          workspace_editor_subscription_reference = ${paymentReference},
          workspace_editor_subscription_updated_at = now()
        where id = ${access.clientId}::uuid
      `);
      const appBase = (req.headers.referer as string) || process.env.APP_URL || "http://localhost:5173";
      const checkoutUrl = `${req.protocol}://${req.get("host")}/api/platform/workspace/billing/simulation?reference=${paymentReference}&plan=${plan}&client_id=${access.clientId}&redirect=${encodeURIComponent(appBase)}`;
      res.status(202).json({ checkout_url: checkoutUrl, payment_provider: "simulation" });
      return;
    }

    const priceId = PLAN_PRICES[plan];
    if (!priceId) {
      res.status(503).json({ error: { code: "billing_not_configured", message: `Stripe price for plan "${plan}" is not configured.` } });
      return;
    }

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const successUrl = `${appUrl}/client/workspace?projectId=${projectId}&checkout=success`;
    const cancelUrl = `${appUrl}/client/workspace?projectId=${projectId}&checkout=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: access.clientEmail,
      metadata: {
        organization_id: organization.id,
        project_id: projectId,
        client_id: access.clientId,
        plan,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await db.execute(sql`
      update clients
      set
        workspace_editor_subscription_status = 'pending',
        workspace_editor_subscription_plan = ${plan},
        workspace_editor_subscription_reference = ${session.id},
        workspace_editor_subscription_updated_at = now()
      where id = ${access.clientId}::uuid
    `);

    res.status(202).json({
      checkout_url: session.url,
      checkout_session_id: session.id,
      payment_provider: "stripe",
    });
  },
);

// ── Stripe webhook ────────────────────────────────────────────────────────────
// IMPORTANT: this handler needs the raw request body (Buffer) to verify the
// Stripe signature. It must be mounted in app.ts BEFORE the global
// express.json() middleware runs, or the body will already be parsed/consumed
// by the time it gets here. See webhookRouter export below + app.ts wiring.

export const webhookRouter = Router();

webhookRouter.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Stripe is not configured" });
      return;
    }

    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      res.status(400).json({ error: "Webhook signature or secret missing" });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err) {
      res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
      return;
    }

    try {
      await handleStripeEvent(event);
    } catch (err) {
      // Log but always return 200 so Stripe doesn't retry indefinitely.
      console.error("[billing/webhook] handler error", event.type, err);
    }

    res.json({ received: true });
  },
);

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleStripeEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await activateWorkspaceSubscription(session);
    return;
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const clientId = typeof pi.metadata?.client_id === "string" ? pi.metadata.client_id : null;
    if (clientId) {
      await db.execute(sql`
        update clients
        set workspace_editor_subscription_status = 'payment_failed', workspace_editor_subscription_updated_at = now()
        where id = ${clientId}::uuid
      `);
    }
  }
}

async function activateWorkspaceSubscription(session: Stripe.Checkout.Session) {
  const { organization_id, project_id, client_id, plan } = session.metadata ?? {};
  if (!client_id || !plan) return;

  const isUnlimited = plan === "unlimited";
  const extraRounds = PLAN_EXTRA_ROUNDS[plan] ?? 0;

  await db.execute(sql`
    update clients
    set
      workspace_editor_subscription_active = ${isUnlimited},
      workspace_editor_subscription_plan = ${plan},
      workspace_editor_subscription_status = 'active',
      workspace_editor_extra_revision_rounds = workspace_editor_extra_revision_rounds + ${extraRounds},
      workspace_editor_subscription_updated_at = now()
    where id = ${client_id}::uuid
  `);

  if (project_id && organization_id) {
    await db.execute(sql`
      insert into activity_events (organization_id, actor_user_id, project_id, event_type, message, metadata)
      values (
        ${organization_id}::uuid,
        null,
        ${project_id}::uuid,
        'workspace_subscription_activated',
        ${`Stripe payment confirmed for ${plan} revision plan`},
        ${JSON.stringify({ plan, sessionId: session.id, clientId: client_id })}::jsonb
      )
    `);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function queryRows<T>(statement: ReturnType<typeof sql>) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

export default router;
