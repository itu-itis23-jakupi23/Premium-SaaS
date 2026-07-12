import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import {
  addProjectMember,
  cleanupTestOrg,
  createTestClient,
  createTestOrg,
  createTestProject,
  createTestUser,
  loginAs,
  type TestOrg,
  type TestProject,
  type TestUser,
} from "../test/helpers";

describe("platform message contacts", () => {
  let org: TestOrg;
  let chief: TestUser;
  let assignedPm: TestUser;
  let otherPm: TestUser;
  let assignedClientUser: TestUser;
  let unassignedClientUser: TestUser;
  let chiefCookies: string[];
  let pmCookies: string[];
  let clientCookies: string[];
  let project: TestProject;

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    assignedPm = await createTestUser(org.id, "pm");
    otherPm = await createTestUser(org.id, "pm");
    assignedClientUser = await createTestUser(org.id, "client");
    unassignedClientUser = await createTestUser(org.id, "client");

    chiefCookies = await loginAs(app, org.slug, chief);
    pmCookies = await loginAs(app, org.slug, assignedPm);
    clientCookies = await loginAs(app, org.slug, assignedClientUser);

    const assignedClient = await createTestClient(org.id, {
      status: "active",
      contactEmail: assignedClientUser.email,
      assignedPmUserId: assignedPm.id,
    });
    await createTestClient(org.id, {
      status: "active",
      contactEmail: unassignedClientUser.email,
      assignedPmUserId: null,
    });

    project = await createTestProject(org.id, assignedClient.id, {
      status: "planning",
      assignedPmUserId: assignedPm.id,
    });
    await addProjectMember(project.id, assignedPm.id, "pm");
    await addProjectMember(project.id, assignedClientUser.id, "client");
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("returns only reachable contacts for each role", async () => {
    const pmContacts = await request(app)
      .get("/api/platform/messages/contacts")
      .set("Cookie", pmCookies);
    expect(pmContacts.status).toBe(200);
    expect(contactIds(pmContacts.body)).toContain(chief.id);
    expect(contactIds(pmContacts.body)).toContain(assignedClientUser.id);
    expect(contactIds(pmContacts.body)).not.toContain(unassignedClientUser.id);
    expect(contactIds(pmContacts.body)).not.toContain(otherPm.id);

    const clientContacts = await request(app)
      .get("/api/platform/messages/contacts")
      .set("Cookie", clientCookies);
    expect(clientContacts.status).toBe(200);
    expect(contactIds(clientContacts.body)).toContain(assignedPm.id);
    expect(contactIds(clientContacts.body)).not.toContain(chief.id);
    expect(contactIds(clientContacts.body)).not.toContain(otherPm.id);
    expect(contactIds(clientContacts.body)).not.toContain(unassignedClientUser.id);

    const chiefContacts = await request(app)
      .get("/api/platform/messages/contacts")
      .set("Cookie", chiefCookies);
    expect(chiefContacts.status).toBe(200);
    expect(contactIds(chiefContacts.body)).toContain(assignedPm.id);
    expect(contactIds(chiefContacts.body)).toContain(assignedClientUser.id);
    expect(contactIds(chiefContacts.body)).toContain(unassignedClientUser.id);
  });

  it("allows scoped conversations only for authorized project participants", async () => {
    const pmReadsAssignedClient = await request(app)
      .get(`/api/platform/messages/${assignedClientUser.id}?projectId=${encodeURIComponent(project.id)}`)
      .set("Cookie", pmCookies);
    expect(pmReadsAssignedClient.status).toBe(200);
    expect(pmReadsAssignedClient.body.scope).toMatchObject({ projectId: project.id, isScoped: true });

    const clientReadsAssignedPm = await request(app)
      .get(`/api/platform/messages/${assignedPm.id}?projectId=${encodeURIComponent(project.id)}`)
      .set("Cookie", clientCookies);
    expect(clientReadsAssignedPm.status).toBe(200);
    expect(clientReadsAssignedPm.body.scope).toMatchObject({ projectId: project.id, isScoped: true });

    const chiefReadsProjectThread = await request(app)
      .get(`/api/platform/messages/${assignedPm.id}?projectId=${encodeURIComponent(project.id)}`)
      .set("Cookie", chiefCookies);
    expect(chiefReadsProjectThread.status).toBe(200);
    expect(chiefReadsProjectThread.body.scope).toMatchObject({ projectId: project.id, isScoped: true });

    const pmCannotReadUnassignedClient = await request(app)
      .get(`/api/platform/messages/${unassignedClientUser.id}?projectId=${encodeURIComponent(project.id)}`)
      .set("Cookie", pmCookies);
    expect(pmCannotReadUnassignedClient.status).toBe(404);
    expect(pmCannotReadUnassignedClient.body.error.code).toBe("contact_not_found");
  });
});

function contactIds(body: unknown) {
  const contacts = (body as { contacts?: Array<{ id: string }> }).contacts ?? [];
  return contacts.map((contact) => contact.id);
}
