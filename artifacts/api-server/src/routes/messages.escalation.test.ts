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
  type TestUser,
} from "../test/helpers";

const contactIds = (body: { contacts?: { id: string }[] }) => (body.contacts ?? []).map((c) => c.id);

describe("client <-> chief escalation", () => {
  let org: TestOrg;
  let chief: TestUser;
  let pm: TestUser;
  let clientUser: TestUser;
  let strangerClient: TestUser;
  let chiefCookies: string[];
  let clientCookies: string[];
  let strangerCookies: string[];

  beforeAll(async () => {
    org = await createTestOrg();
    chief = await createTestUser(org.id, "chief");
    pm = await createTestUser(org.id, "pm");
    clientUser = await createTestUser(org.id, "client");
    strangerClient = await createTestUser(org.id, "client");

    chiefCookies = await loginAs(app, org.slug, chief);
    clientCookies = await loginAs(app, org.slug, clientUser);
    strangerCookies = await loginAs(app, org.slug, strangerClient);

    const client = await createTestClient(org.id, {
      status: "active",
      contactEmail: clientUser.email,
      assignedPmUserId: pm.id,
    });
    const project = await createTestProject(org.id, client.id, {
      status: "planning",
      assignedPmUserId: pm.id,
    });
    await addProjectMember(project.id, pm.id, "pm");
    await addProjectMember(project.id, clientUser.id, "client");
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
  });

  it("keeps chiefs out of the default contact list until a thread exists", async () => {
    const contacts = await request(app)
      .get("/api/platform/messages/contacts")
      .set("Cookie", clientCookies);

    expect(contacts.status).toBe(200);
    expect(contactIds(contacts.body)).toContain(pm.id);
    expect(contactIds(contacts.body)).not.toContain(chief.id);
  });

  it("refuses a client message to a chief that is not an explicit escalation", async () => {
    const send = await request(app)
      .post(`/api/platform/messages/${chief.id}`)
      .set("Cookie", clientCookies)
      .send({ body: "Sneaking in without escalating." });

    expect(send.status).toBe(404);
  });

  it("offers the chief as an escalation target to a client with a project", async () => {
    const targets = await request(app)
      .get("/api/platform/messages/escalation-targets")
      .set("Cookie", clientCookies);

    expect(targets.status).toBe(200);
    expect((targets.body.targets ?? []).map((t: { id: string }) => t.id)).toContain(chief.id);
  });

  it("offers no escalation target to a client with no project", async () => {
    const targets = await request(app)
      .get("/api/platform/messages/escalation-targets")
      .set("Cookie", strangerCookies);

    expect(targets.status).toBe(200);
    expect(targets.body.targets ?? []).toHaveLength(0);
  });

  it("lets a client escalate, then converse normally with the chief", async () => {
    const escalate = await request(app)
      .post(`/api/platform/messages/${chief.id}`)
      .set("Cookie", clientCookies)
      .send({ body: "I would like to escalate this.", escalate: true });

    expect(escalate.status).toBe(201);

    const contacts = await request(app)
      .get("/api/platform/messages/contacts")
      .set("Cookie", clientCookies);
    expect(contactIds(contacts.body)).toContain(chief.id);

    const read = await request(app)
      .get(`/api/platform/messages/${chief.id}`)
      .set("Cookie", clientCookies);
    expect(read.status).toBe(200);

    // Escalation is a one-time door, not a standing one: the thread now exists,
    // so an ordinary follow-up needs no flag.
    const followUp = await request(app)
      .post(`/api/platform/messages/${chief.id}`)
      .set("Cookie", clientCookies)
      .send({ body: "Adding one more detail." });
    expect(followUp.status).toBe(201);
  });

  it("delivers a chief-initiated message to the client instead of dropping it", async () => {
    const freshClient = await createTestUser(org.id, "client");
    const freshCookies = await loginAs(app, org.slug, freshClient);
    const client = await createTestClient(org.id, {
      status: "active",
      contactEmail: freshClient.email,
      assignedPmUserId: pm.id,
    });
    const project = await createTestProject(org.id, client.id, {
      status: "planning",
      assignedPmUserId: pm.id,
    });
    await addProjectMember(project.id, pm.id, "pm");
    await addProjectMember(project.id, freshClient.id, "client");

    const chiefSend = await request(app)
      .post(`/api/platform/messages/${freshClient.id}`)
      .set("Cookie", chiefCookies)
      .send({ body: "Reaching out from the chief." });
    expect(chiefSend.status).toBe(201);

    // The regression: the send above used to succeed while the client got a 404
    // here, so the message was accepted and silently never delivered.
    const read = await request(app)
      .get(`/api/platform/messages/${chief.id}`)
      .set("Cookie", freshCookies);
    expect(read.status).toBe(200);
    expect(read.body.messages.map((m: { body: string }) => m.body)).toContain("Reaching out from the chief.");

    const reply = await request(app)
      .post(`/api/platform/messages/${chief.id}`)
      .set("Cookie", freshCookies)
      .send({ body: "Thanks, replying." });
    expect(reply.status).toBe(201);
  });
});
