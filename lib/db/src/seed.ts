import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { organizations, users, memberships, clients } from "./schema";
import { randomBytes, scryptSync } from "node:crypto";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:v1:${salt}:${derived}`;
}

// Idempotent: upserts by natural key (org slug, user email, membership PK,
// client org+email) so it is safe to re-run against a seeded database.
async function main() {
  console.log("Seeding database...");

  const [org] = await db
    .insert(organizations)
    .values({
      name: "ENS Demo Agency",
      slug: "ens-demo-agency",
      legalName: "Exposition Nobel Service",
      plan: "starter",
      timezone: "Europe/Istanbul",
      seatLimit: 10,
      activeProjectLimit: 20,
      storageLimitMb: 10240,
      metadata: {},
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: "ENS Demo Agency", updatedAt: new Date() },
    })
    .returning();

  console.log(`Organization ready: ${org.name} (${org.id})`);

  const seedUsers = [
    { email: "owner@ens.test", name: "Owner Chief", role: "chief" as const, avatarTone: "primary" },
    { email: "pm@ens.test", name: "Project Manager", role: "pm" as const, avatarTone: "blue" },
    { email: "client@ens.test", name: "Client Reviewer", role: "client" as const, avatarTone: "green" },
  ];

  const userIds: Record<string, string> = {};
  for (const seedUser of seedUsers) {
    // Re-hash on every run so re-seeding restores the known dev password.
    const [row] = await db
      .insert(users)
      .values({
        email: seedUser.email,
        name: seedUser.name,
        role: seedUser.role,
        passwordHash: hashPassword("EnsDev2026!"),
        metadata: { profile: { avatarUrl: "", avatarTone: seedUser.avatarTone } },
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { name: seedUser.name, role: seedUser.role, passwordHash: hashPassword("EnsDev2026!"), updatedAt: new Date() },
      })
      .returning();
    userIds[seedUser.email] = row.id;
  }

  console.log("Users ready");

  for (const seedUser of seedUsers) {
    await db
      .insert(memberships)
      .values({
        organizationId: org.id,
        userId: userIds[seedUser.email],
        role: seedUser.role,
        status: "active",
        joinedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  console.log("Memberships ready");

  const existingClient = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, org.id), eq(clients.contactEmail, "client@ens.test")))
    .limit(1);

  // Intake fields mirror what a real client signup provides, so demo flows
  // (auto-created exhibition name, inherited project deadline) behave like production.
  const intakeDeadline = new Date();
  intakeDeadline.setDate(intakeDeadline.getDate() + 60);

  if (existingClient.length === 0) {
    const [clientRecord] = await db
      .insert(clients)
      .values({
        organizationId: org.id,
        companyName: "Acme Corp",
        contactName: "Client Reviewer",
        contactEmail: "client@ens.test",
        status: "active",
        activatedAt: new Date(),
        intakeExhibitionName: "Acme Corp Exhibition",
        intakeBoothSizeSqm: "18.00",
        intakeCity: "Istanbul",
        intakeDeadlineAt: intakeDeadline,
        intakePreferredSystem: "octanorm",
        intakeNotes: "Seeded demo client",
        metadata: {},
      })
      .returning();
    console.log(`Client record created: ${clientRecord.companyName} (${clientRecord.id})`);
  } else {
    await db
      .update(clients)
      .set({
        intakeExhibitionName: "Acme Corp Exhibition",
        intakeBoothSizeSqm: "18.00",
        intakeCity: "Istanbul",
        intakeDeadlineAt: intakeDeadline,
        intakePreferredSystem: "octanorm",
        updatedAt: new Date(),
      })
      .where(and(eq(clients.organizationId, org.id), eq(clients.contactEmail, "client@ens.test")));
    console.log("Client record already present — refreshed intake fields");
  }

  console.log("Seeding completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
