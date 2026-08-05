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
  let otherAssignedClientUser: TestUser;
  let unassignedClientUser: TestUser;
  let chiefCookies: string[];
  let pmCookies: string[];
  let clientCookies: string[];
  let project: TestProject;
  let otherProject: TestProject;

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    assignedPm = await createTestUser(org.id, "pm");
    otherPm = await createTestUser(org.id, "pm");
    assignedClientUser = await createTestUser(org.id, "client");
    otherAssignedClientUser = await createTestUser(org.id, "client");
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

    const otherAssignedClient = await createTestClient(org.id, {
      status: "active",
      contactEmail: otherAssignedClientUser.email,
      assignedPmUserId: assignedPm.id,
    });
    otherProject = await createTestProject(org.id, otherAssignedClient.id, {
      status: "planning",
      assignedPmUserId: assignedPm.id,
    });
    await addProjectMember(otherProject.id, assignedPm.id, "pm");
    await addProjectMember(otherProject.id, otherAssignedClientUser.id, "client");
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

    const clientCannotReadAnotherClientProject = await request(app)
      .get(`/api/platform/messages/${assignedPm.id}?projectId=${encodeURIComponent(otherProject.id)}`)
      .set("Cookie", clientCookies);
    expect(clientCannotReadAnotherClientProject.status).toBe(404);
    expect(clientCannotReadAnotherClientProject.body.error.code).toBe("message_scope_denied");

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

  it("keeps PM and client on the same project-scoped thread", async () => {
    const body = `project-thread-${Date.now()}`;
    const sent = await request(app)
      .post(`/api/platform/messages/${assignedClientUser.id}`)
      .set("Cookie", pmCookies)
      .send({ body, context: { projectId: project.id } });
    expect(sent.status).toBe(201);

    const received = await request(app)
      .get(`/api/platform/messages/${assignedPm.id}?projectId=${encodeURIComponent(project.id)}`)
      .set("Cookie", clientCookies);
    expect(received.status).toBe(200);
    expect(received.body.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ body, isMe: false }),
    ]));
  });

  it("persists Chief attachments and allows the addressed PM to download them", async () => {
    const bytes = Buffer.from(`chief-message-attachment-${Date.now()}`, "utf8");
    const upload = await request(app)
      .post("/api/platform/messages/attachments")
      .set("Cookie", chiefCookies)
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", "chief-brief.pdf")
      .send(bytes);

    expect(upload.status, JSON.stringify(upload.body)).toBe(201);
    expect(upload.body.attachment).toMatchObject({
      name: "chief-brief.pdf",
      size: bytes.byteLength,
      type: "application/pdf",
    });

    const body = `chief-to-pm-${Date.now()}`;
    const sent = await request(app)
      .post(`/api/platform/messages/${assignedPm.id}`)
      .set("Cookie", chiefCookies)
      .send({ body, attachments: [upload.body.attachment] });
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);
    expect(sent.body.message).toMatchObject({
      body,
      attachments: [expect.objectContaining({ id: upload.body.attachment.id, name: "chief-brief.pdf" })],
    });

    const received = await request(app)
      .get(`/api/platform/messages/${chief.id}`)
      .set("Cookie", pmCookies);
    expect(received.status, JSON.stringify(received.body)).toBe(200);
    expect(received.body.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        body,
        isMe: false,
        attachments: [expect.objectContaining({ id: upload.body.attachment.id })],
      }),
    ]));

    const download = await request(app)
      .get(`/api/platform/messages/attachments/${upload.body.attachment.id}`)
      .set("Cookie", pmCookies);
    expect(download.status, JSON.stringify(download.body)).toBe(200);
    expect(Buffer.from(download.body)).toEqual(bytes);
  });

  it("rejects malformed contact and project identifiers without database errors", async () => {
    const malformedProject = await request(app)
      .get(`/api/platform/messages/${assignedClientUser.id}?projectId=not-a-uuid`)
      .set("Cookie", pmCookies);
    expect(malformedProject.status).toBe(404);
    expect(malformedProject.body.error.code).toBe("message_scope_denied");

    const malformedContact = await request(app)
      .get("/api/platform/messages/not-a-uuid")
      .set("Cookie", pmCookies);
    expect(malformedContact.status).toBe(404);
    expect(malformedContact.body.error.code).toBe("contact_not_found");

    const malformedPostContact = await request(app)
      .post("/api/platform/messages/not-a-uuid")
      .set("Cookie", pmCookies)
      .send({ body: "must not reach a UUID cast" });
    expect(malformedPostContact.status).toBe(404);
    expect(malformedPostContact.body.error.code).toBe("contact_not_found");
  });
});

function contactIds(body: unknown) {
  const contacts = (body as { contacts?: Array<{ id: string }> }).contacts ?? [];
  return contacts.map((contact) => contact.id);
}
