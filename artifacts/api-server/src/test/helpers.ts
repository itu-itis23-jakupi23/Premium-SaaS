import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Express } from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { hashPassword } from "../lib/password";

async function queryRows<T>(statement: ReturnType<typeof sql>) {
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

export interface TestOrg {
  id: string;
  slug: string;
}

export async function createTestOrg(): Promise<TestOrg> {
  const slug = `test-org-${randomUUID().slice(0, 8)}`;
  const rows = await queryRows<{ id: string }>(sql`
    insert into organizations (name, slug, plan, timezone, seat_limit, active_project_limit, storage_limit_mb, metadata)
    values (${slug}, ${slug}, 'starter', 'Europe/Istanbul', 10, 20, 10240, '{}'::jsonb)
    returning id::text
  `);
  return { id: rows[0].id, slug };
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createTestUser(orgId: string, role: "chief" | "pm" | "client", overrides?: { password?: string }): Promise<TestUser> {
  const email = `${role}-${randomUUID().slice(0, 8)}@test.local`;
  const password = overrides?.password ?? "TestPass123!";
  const passwordHash = hashPassword(password);

  const rows = await queryRows<{ id: string }>(sql`
    insert into users (email, name, role, password_hash, email_verified_at, metadata)
    values (${email}, ${`Test ${role}`}, ${role === "client" ? "client" : role}::user_role, ${passwordHash}, now(), '{}'::jsonb)
    returning id::text
  `);
  const userId = rows[0].id;

  await db.execute(sql`
    insert into memberships (organization_id, user_id, role, status, joined_at)
    values (${orgId}::uuid, ${userId}::uuid, ${role}::user_role, 'active', now())
  `);

  return { id: userId, email, password };
}

export interface TestClient {
  id: string;
}

export async function createTestClient(orgId: string, opts: { status?: string; contactEmail?: string; assignedPmUserId?: string | null } = {}): Promise<TestClient> {
  const rows = await queryRows<{ id: string }>(sql`
    insert into clients (organization_id, company_name, contact_name, contact_email, status, assigned_pm_user_id, metadata)
    values (
      ${orgId}::uuid,
      ${"Test Client Co"},
      ${"Test Contact"},
      ${opts.contactEmail ?? `client-${randomUUID().slice(0, 8)}@test.local`},
      ${(opts.status ?? "pending_approval")}::client_status,
      ${opts.assignedPmUserId ?? null}::uuid,
      '{}'::jsonb
    )
    returning id::text
  `);
  return { id: rows[0].id };
}

export interface TestProject {
  id: string;
}

export async function createTestProject(orgId: string, clientId: string, opts: { status?: string; assignedPmUserId?: string | null } = {}): Promise<TestProject> {
  const rows = await queryRows<{ id: string }>(sql`
    insert into projects (organization_id, client_id, assigned_pm_user_id, name, exhibition_name, status, health, budget_cents, currency)
    values (
      ${orgId}::uuid,
      ${clientId}::uuid,
      ${opts.assignedPmUserId ?? null}::uuid,
      'Test Project',
      'Test Exhibition',
      ${(opts.status ?? "planning")}::project_status,
      'on_track'::project_health,
      0,
      'EUR'
    )
    returning id::text
  `);
  const projectId = rows[0].id;

  // A project requires a booth_design row for getProjectAccess to resolve it.
  await db.execute(sql`
    insert into booth_designs (organization_id, project_id, name, booth_system, booth_type, width_mm, depth_mm, height_mm)
    values (${orgId}::uuid, ${projectId}::uuid, 'Main booth design', 'octanorm'::booth_system, 'inline'::booth_type, 6000, 3000, 2500)
  `);

  return { id: projectId };
}

export async function addProjectMember(projectId: string, userId: string, role: "chief" | "pm" | "client") {
  await db.execute(sql`
    insert into project_members (project_id, user_id, role)
    values (${projectId}::uuid, ${userId}::uuid, ${role}::user_role)
    on conflict (project_id, user_id) do nothing
  `);
}

/** Logs in via the real /auth/login route and returns the Set-Cookie header
 * array so callers can attach it to subsequent supertest requests. */
export async function loginAs(app: Express, slug: string, user: TestUser): Promise<string[]> {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: user.password, organizationSlug: slug });
  if (response.status !== 200) {
    throw new Error(`loginAs failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  const cookies = response.get("Set-Cookie");
  if (!cookies) throw new Error("loginAs: no Set-Cookie header returned");
  return cookies;
}

export async function cleanupTestOrg(orgId: string) {
  // Find every user whose only membership is in this org so we don't orphan
  // shared accounts, then delete the org (cascades clients/projects/etc.)
  // and finally the users themselves (users are not FK'd to organizations).
  const userRows = await queryRows<{ id: string }>(sql`
    select user_id::text as id from memberships where organization_id = ${orgId}::uuid
  `);
  await db.execute(sql`delete from organizations where id = ${orgId}::uuid`);
  for (const user of userRows) {
    await db.execute(sql`delete from users where id = ${user.id}::uuid`);
  }
}
