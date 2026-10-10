import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import {
  cleanupTestOrg,
  createTestClient,
  createTestOrg,
  createTestUser,
  loginAs,
  type TestOrg,
  type TestUser,
} from "../test/helpers";

const SETTINGS = "/api/platform/account/settings";

/**
 * The company block on the account settings endpoint, which has two owners.
 *
 * `name` and `contactEmail` come from the agency's `clients` row and are
 * read-only: the client portal showed them as editable fields with a save
 * button that persisted nothing, and letting them through would rename the row
 * every invoice and project is filed under. `industry` and `website` are the
 * client's own and are stored on the user.
 */
describe("account settings company block", () => {
  let org: TestOrg;
  let otherOrg: TestOrg;
  let clientUser: TestUser;
  let pm: TestUser;
  let strangerClient: TestUser;
  let clientCookies: string[];
  let pmCookies: string[];
  let strangerCookies: string[];

  beforeAll(async () => {
    org = await createTestOrg();
    otherOrg = await createTestOrg();

    pm = await createTestUser(org.id, "pm");
    clientUser = await createTestUser(org.id, "client");
    strangerClient = await createTestUser(org.id, "client");

    clientCookies = await loginAs(app, org.slug, clientUser);
    pmCookies = await loginAs(app, org.slug, pm);
    strangerCookies = await loginAs(app, org.slug, strangerClient);

    await createTestClient(org.id, {
      status: "active",
      contactEmail: clientUser.email,
      assignedPmUserId: pm.id,
    });

    // The same person's email on a client row in a different organisation. The
    // lookup is scoped by organisation, so this must stay invisible.
    await createTestClient(otherOrg.id, {
      status: "active",
      contactEmail: strangerClient.email,
    });
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
    await cleanupTestOrg(otherOrg.id);
  });

  it("reports the agency's client record as the company", async () => {
    const response = await request(app).get(SETTINGS).set("Cookie", clientCookies);

    expect(response.status).toBe(200);
    expect(response.body.company).toMatchObject({
      name: "Test Client Co",
      contactEmail: clientUser.email,
      managedByAgency: true,
    });
  });

  it("marks staff as having no agency-held company", async () => {
    const response = await request(app).get(SETTINGS).set("Cookie", pmCookies);

    expect(response.status).toBe(200);
    // A PM has no client row behind them, so the field is blank rather than
    // borrowing some other record's name.
    expect(response.body.company).toMatchObject({
      name: "",
      contactEmail: "",
      managedByAgency: false,
    });
  });

  it("does not read a client record from another organisation", async () => {
    const response = await request(app).get(SETTINGS).set("Cookie", strangerCookies);

    expect(response.status).toBe(200);
    expect(response.body.company.name).toBe("");
    expect(response.body.company.managedByAgency).toBe(false);
  });

  it("persists the industry and website the client owns", async () => {
    const saved = await request(app)
      .put(SETTINGS)
      .set("Cookie", clientCookies)
      .send({ company: { industry: "Automotive", website: "https://example.com" } });

    expect(saved.status).toBe(200);
    expect(saved.body.company).toMatchObject({
      industry: "Automotive",
      website: "https://example.com",
    });

    const reread = await request(app).get(SETTINGS).set("Cookie", clientCookies);
    expect(reread.body.company).toMatchObject({
      industry: "Automotive",
      website: "https://example.com",
      name: "Test Client Co",
    });
  });

  it("ignores an attempt to rename the agency's company record", async () => {
    const saved = await request(app)
      .put(SETTINGS)
      .set("Cookie", clientCookies)
      .send({
        company: {
          name: "Renamed By Client Ltd",
          contactEmail: "someone-else@test.local",
          industry: "Automotive",
        },
      });

    expect(saved.status).toBe(200);
    expect(saved.body.company.name).toBe("Test Client Co");
    expect(saved.body.company.contactEmail).toBe(clientUser.email);
  });

  it("keeps the website when only the industry is sent", async () => {
    await request(app)
      .put(SETTINGS)
      .set("Cookie", clientCookies)
      .send({ company: { industry: "Automotive", website: "https://example.com" } });

    const saved = await request(app)
      .put(SETTINGS)
      .set("Cookie", clientCookies)
      .send({ company: { industry: "Logistics" } });

    expect(saved.status).toBe(200);
    expect(saved.body.company.industry).toBe("Logistics");
    // Absent is not empty. Reading a missing key as "" would make a partial
    // save silently erase the other field.
    expect(saved.body.company.website).toBe("https://example.com");
  });

  it("clears a field that is sent as an empty string", async () => {
    const saved = await request(app)
      .put(SETTINGS)
      .set("Cookie", clientCookies)
      .send({ company: { website: "" } });

    expect(saved.status).toBe(200);
    expect(saved.body.company.website).toBe("");
  });

  it("leaves the company block alone when the save is about something else", async () => {
    await request(app)
      .put(SETTINGS)
      .set("Cookie", clientCookies)
      .send({ company: { industry: "Logistics", website: "https://example.com" } });

    const saved = await request(app)
      .put(SETTINGS)
      .set("Cookie", clientCookies)
      .send({ appearance: { compact: true } });

    expect(saved.status).toBe(200);
    expect(saved.body.company).toMatchObject({
      industry: "Logistics",
      website: "https://example.com",
    });
  });

  it("rejects a website with no scheme", async () => {
    const saved = await request(app)
      .put(SETTINGS)
      .set("Cookie", clientCookies)
      .send({ company: { website: "example.com" } });

    expect(saved.status).toBe(400);
    expect(String(saved.body.error)).toMatch(/http/i);
  });

  it("rejects a javascript: URL dressed as a website", async () => {
    const saved = await request(app)
      .put(SETTINGS)
      .set("Cookie", clientCookies)
      // Nothing renders this as an anchor yet, which is the only reason this
      // is not already exploitable. The scheme check is what keeps it that way
      // the day someone does. The form's own z.string().url() passes it -
      // new URL() accepts javascript: - so the server check is the real guard.
      .send({ company: { website: "javascript://example.com/%0aalert(1)" } });

    expect(saved.status).toBe(400);
  });

  it("requires a session", async () => {
    const anonymous = await request(app).get(SETTINGS);
    expect(anonymous.status).toBe(401);
  });
});
