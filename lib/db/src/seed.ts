import { db } from "./index";
import { organizations, users, memberships, clients } from "./schema";
import { randomBytes, scryptSync } from "node:crypto";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:v1:${salt}:${derived}`;
}

async function main() {
  console.log("Seeding database...");
  
  // 1. Create Organization
  const [org] = await db.insert(organizations).values({
    name: "ENS Demo Agency",
    slug: "ens-demo-agency",
    legalName: "Exposition Nobel Service",
    plan: "starter",
    timezone: "Europe/Istanbul",
    seatLimit: 10,
    activeProjectLimit: 20,
    storageLimitMb: 10240,
    metadata: {},
  }).returning();
  
  console.log(`Created organization: ${org.name} (${org.id})`);
  
  // 2. Create Users
  const passwordHash = hashPassword("EnsDev2026!");
  
  const [chiefUser] = await db.insert(users).values({
    email: "owner@ens.test",
    name: "Owner Chief",
    role: "chief",
    passwordHash: passwordHash,
    metadata: { profile: { avatarUrl: "", avatarTone: "primary" } },
  }).returning();
  
  const [pmUser] = await db.insert(users).values({
    email: "pm@ens.test",
    name: "Project Manager",
    role: "pm",
    passwordHash: passwordHash,
    metadata: { profile: { avatarUrl: "", avatarTone: "blue" } },
  }).returning();
  
  const [clientUser] = await db.insert(users).values({
    email: "client@ens.test",
    name: "Client Reviewer",
    role: "client",
    passwordHash: passwordHash,
    metadata: { profile: { avatarUrl: "", avatarTone: "green" } },
  }).returning();
  
  console.log("Created users");
  
  // 3. Create Memberships
  await db.insert(memberships).values([
    {
      organizationId: org.id,
      userId: chiefUser.id,
      role: "chief",
      status: "active",
      joinedAt: new Date(),
    },
    {
      organizationId: org.id,
      userId: pmUser.id,
      role: "pm",
      status: "active",
      joinedAt: new Date(),
    },
    {
      organizationId: org.id,
      userId: clientUser.id,
      role: "client",
      status: "active",
      joinedAt: new Date(),
    },
  ]);
  
  console.log("Created memberships");
  
  // 4. Create Client Record
  const [clientRecord] = await db.insert(clients).values({
    organizationId: org.id,
    companyName: "Acme Corp",
    contactName: "Client Reviewer",
    contactEmail: "client@ens.test",
    status: "active",
    activatedAt: new Date(),
    metadata: {},
  }).returning();
  
  console.log(`Created client record: ${clientRecord.companyName} (${clientRecord.id})`);
  console.log("Seeding completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
