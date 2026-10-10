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

/**
 * Client furniture proposals.
 *
 * The rule under test throughout is that a proposal may move furniture and
 * nothing else. The client portal is the untrusted side of this feature, so
 * most of what follows is an attempt to get something structural through it.
 */
describe("client workspace proposals", () => {
  let org: TestOrg;
  let pm: TestUser;
  let clientUser: TestUser;
  let strangerClient: TestUser;
  let pmCookies: string[];
  let clientCookies: string[];
  let strangerCookies: string[];
  let project: TestProject;
  let foreignOrg: TestOrg;
  let foreignChiefCookies: string[];

  const furniture = {
    id: "f-new", catalogId: "cat-chair", name: "Chair", sku: "CH1", qty: 1,
    w: 0.5, d: 0.5, h: 0.9, color: "#111111", weight: 6, x: 2, z: 1,
    rotation: 0, kind: "furniture" as const, shape: "chair",
  };

  interface Layout {
    booth: { width: number; depth: number };
    placedItems: { id: string; kind: string }[];
  }

  async function currentDesign(): Promise<Layout> {
    const res = await request(app)
      .get(`/api/platform/projects/${project.id}/workspace`)
      .set("Cookie", pmCookies);
    expect(res.status).toBe(200);
    return res.body.workspace as Layout;
  }

  async function saveProposal(items: unknown[], cookies = clientCookies) {
    const base = await currentDesign();
    return request(app)
      .put(`/api/platform/projects/${project.id}/workspace/proposal`)
      .set("Cookie", cookies)
      .send({ title: "proposal", workspace: { ...base, placedItems: items } });
  }

  const ids = (items: { id: string }[]) => items.map((i) => i.id).sort();

  beforeAll(async () => {
    org = await createTestOrg();
    pm = await createTestUser(org.id, "pm");
    clientUser = await createTestUser(org.id, "client");
    strangerClient = await createTestUser(org.id, "client");
    pmCookies = await loginAs(app, org.slug, pm);
    clientCookies = await loginAs(app, org.slug, clientUser);
    strangerCookies = await loginAs(app, org.slug, strangerClient);

    const client = await createTestClient(org.id, {
      status: "active", contactEmail: clientUser.email, assignedPmUserId: pm.id,
    });
    await createTestClient(org.id, {
      status: "active", contactEmail: strangerClient.email, assignedPmUserId: pm.id,
    });
    project = await createTestProject(org.id, client.id, {
      status: "client_review", assignedPmUserId: pm.id,
    });
    await addProjectMember(project.id, pm.id, "pm");
    await addProjectMember(project.id, clientUser.id, "client");

    // A design for the client to propose against, carrying a structure item the
    // client must not be able to touch.
    const setup = await request(app)
      .put(`/api/platform/projects/${project.id}/workspace`)
      .set("Cookie", pmCookies)
      .send({
        title: "v1",
        workspace: {
          booth: {
            width: 6, depth: 3, height: 2.5, system: "octanorm", companyName: "ACME",
            openFront: true, openBack: false, openLeft: false, openRight: false,
            fasciaEnabled: true, fasciaOption: "full",
          },
          themeIdx: 0,
          carpetIdx: 0,
          notes: [],
          placedItems: [
            { id: "s1", catalogId: "wall", name: "Wall", sku: "W", qty: 1, w: 1, d: 0.1, h: 2.5,
              color: "#ffffff", weight: 20, x: 1, z: 0, rotation: 0, kind: "structure" },
            { id: "f1", catalogId: "cat-table", name: "Table", sku: "T1", qty: 1, w: 1, d: 1, h: 0.75,
              color: "#222222", weight: 12, x: 3, z: 1.5, rotation: 0, kind: "furniture" },
          ],
        },
      });
    expect(setup.status).toBe(200);

    // A neighbouring agency, to prove the proposal routes are tenant-scoped.
    foreignOrg = await createTestOrg();
    const foreignChief = await createTestUser(foreignOrg.id, "chief");
    foreignChiefCookies = await loginAs(app, foreignOrg.slug, foreignChief);
  });

  afterAll(async () => {
    await cleanupTestOrg(org.id);
    await cleanupTestOrg(foreignOrg.id);
  });

  it("lets the client save a furniture layout without touching the design", async () => {
    const res = await saveProposal([{ ...furniture }]);
    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe("draft");
    expect(ids(res.body.proposal.layout.placedItems)).toEqual(["f-new", "s1"]);

    // The PM's design is untouched: still their own furniture, not the client's.
    expect(ids((await currentDesign()).placedItems)).toEqual(["f1", "s1"]);
  });

  it("keeps the booth the PM drew, whatever dimensions the client sends", async () => {
    const base = await currentDesign();
    const res = await request(app)
      .put(`/api/platform/projects/${project.id}/workspace/proposal`)
      .set("Cookie", clientCookies)
      .send({
        title: "proposal",
        workspace: { ...base, booth: { ...base.booth, width: 40, depth: 40 }, placedItems: [furniture] },
      });

    expect(res.status).toBe(200);
    expect(res.body.proposal.layout.booth.width).toBe(6);
    expect(res.body.proposal.layout.booth.depth).toBe(3);
  });

  it("re-seats furniture positioned against a booth the client invented", async () => {
    // The regression: incoming items are clamped against the booth in the
    // payload, so a claimed 40x40 stand let furniture sit at x=35. Putting the
    // PM's 6x3 booth back without re-clamping left it stranded outside.
    const base = await currentDesign();
    const res = await request(app)
      .put(`/api/platform/projects/${project.id}/workspace/proposal`)
      .set("Cookie", clientCookies)
      .send({
        title: "proposal",
        workspace: {
          ...base,
          booth: { ...base.booth, width: 40, depth: 40 },
          placedItems: [{ ...furniture, x: 35, z: 35 }],
        },
      });

    expect(res.status).toBe(200);
    const chair = (res.body.proposal.layout.placedItems as { id: string; x: number; z: number }[])
      .find((item) => item.id === "f-new");
    expect(chair).toBeDefined();
    expect(chair!.x).toBeLessThanOrEqual(6);
    expect(chair!.z).toBeLessThanOrEqual(3);
  });

  it("drops a structure item the client tries to add", async () => {
    const res = await saveProposal([
      furniture,
      { ...furniture, id: "s-sneaky", name: "Extra wall", kind: "structure", x: 5, z: 2 },
    ]);
    expect(res.status).toBe(200);
    expect(ids(res.body.proposal.layout.placedItems)).not.toContain("s-sneaky");
  });

  it("restores a structure item the client tries to delete", async () => {
    // Sending furniture only must not take the PM's wall down with it.
    const res = await saveProposal([furniture]);
    expect(res.status).toBe(200);
    const items = res.body.proposal.layout.placedItems as { id: string; kind: string }[];
    expect(items.find((i) => i.id === "s1")?.kind).toBe("structure");
  });

  it("refuses a proposal from a client on someone else's project", async () => {
    const res = await saveProposal([furniture], strangerCookies);
    expect(res.status).toBe(404);
  });

  it("refuses a proposal from the PM, who edits the design directly", async () => {
    const res = await saveProposal([furniture], pmCookies);
    expect(res.status).toBe(403);
  });

  describe("submit and decide", () => {
    it("spends one revision round on submit and locks further edits", async () => {
      await saveProposal([furniture]);
      const before = await request(app)
        .get(`/api/platform/projects/${project.id}/workspace/proposal`)
        .set("Cookie", clientCookies);
      const usedBefore = before.body.revisions.used as number;

      const submit = await request(app)
        .post(`/api/platform/projects/${project.id}/workspace/proposal/submit`)
        .set("Cookie", clientCookies)
        .send({ note: "Please swap the table for two chairs." });

      expect(submit.status).toBe(200);
      expect(submit.body.proposal.status).toBe("submitted");
      expect(submit.body.revisions.used).toBe(usedBefore + 1);

      // A submitted sandbox is with the PM and is no longer the client's to edit.
      const afterEdit = await saveProposal([furniture]);
      expect(afterEdit.status).toBe(409);
      expect(afterEdit.body.error.code).toBe("proposal_submitted");
    });

    it("merges only furniture when the PM accepts, and leaves structure alone", async () => {
      const open = await request(app)
        .get(`/api/platform/projects/${project.id}/workspace/proposal`)
        .set("Cookie", pmCookies);
      const proposalId = open.body.proposal.id as string;

      const accept = await request(app)
        .post(`/api/platform/projects/${project.id}/workspace/proposal/${proposalId}/accept`)
        .set("Cookie", pmCookies)
        .send({ note: "Looks good." });

      expect(accept.status).toBe(200);
      expect(accept.body.proposal.status).toBe("accepted");

      // The client's chair replaced the PM's table; the wall survived untouched.
      const items = (await currentDesign()).placedItems;
      expect(ids(items)).toEqual(["f-new", "s1"]);
      expect(items.find((i) => i.id === "s1")?.kind).toBe("structure");
    });

    it("frees the project for a new proposal once the last one is decided", async () => {
      const res = await saveProposal([{ ...furniture, id: "f-second" }]);
      expect(res.status).toBe(200);
      expect(res.body.proposal.status).toBe("draft");
    });

    it("lets the client withdraw a draft without spending a round", async () => {
      const before = await request(app)
        .get(`/api/platform/projects/${project.id}/workspace/proposal`)
        .set("Cookie", clientCookies);
      const usedBefore = before.body.revisions.used as number;

      const withdraw = await request(app)
        .post(`/api/platform/projects/${project.id}/workspace/proposal/withdraw`)
        .set("Cookie", clientCookies);
      expect(withdraw.status).toBe(200);
      expect(withdraw.body.proposal).toBeNull();

      const after = await request(app)
        .get(`/api/platform/projects/${project.id}/workspace/proposal`)
        .set("Cookie", clientCookies);
      expect(after.body.proposal).toBeNull();
      expect(after.body.revisions.used).toBe(usedBefore);
    });

    it("records a rejection with a reason the client can read", async () => {
      await saveProposal([{ ...furniture, id: "f-third" }]);
      await request(app)
        .post(`/api/platform/projects/${project.id}/workspace/proposal/submit`)
        .set("Cookie", clientCookies)
        .send({ note: "Another idea." });

      const open = await request(app)
        .get(`/api/platform/projects/${project.id}/workspace/proposal`)
        .set("Cookie", pmCookies);
      const proposalId = open.body.proposal.id as string;

      const reject = await request(app)
        .post(`/api/platform/projects/${project.id}/workspace/proposal/${proposalId}/reject`)
        .set("Cookie", pmCookies)
        .send({ note: "The aisle has to stay clear." });
      expect(reject.status).toBe(200);
      expect(reject.body.proposal.status).toBe("rejected");

      const seen = await request(app)
        .get(`/api/platform/projects/${project.id}/workspace/proposal`)
        .set("Cookie", clientCookies);
      const history = seen.body.history as { status: string; decisionNote: string | null }[];
      expect(
        history.some((h) => h.status === "rejected" && h.decisionNote === "The aisle has to stay clear."),
      ).toBe(true);
    });

    it("refuses a client trying to accept their own proposal", async () => {
      await saveProposal([{ ...furniture, id: "f-fourth" }]);
      await request(app)
        .post(`/api/platform/projects/${project.id}/workspace/proposal/submit`)
        .set("Cookie", clientCookies)
        .send({ note: "Self-serve." });

      const open = await request(app)
        .get(`/api/platform/projects/${project.id}/workspace/proposal`)
        .set("Cookie", clientCookies);
      const proposalId = open.body.proposal.id as string;

      const res = await request(app)
        .post(`/api/platform/projects/${project.id}/workspace/proposal/${proposalId}/accept`)
        .set("Cookie", clientCookies);
      expect(res.status).toBe(403);
    });
  });

  describe("another organization", () => {
    /**
     * Its own project, client and revision budget. The suite above shares one
     * project in sequence, so borrowing it made these depend on how many
     * revisions the earlier cases had already spent - which is not what they
     * are about.
     *
     * The queries behind these routes filter on organization_id as well as
     * project_id, so they are safe even if a future caller forgets to resolve
     * access first. These assert that, rather than trusting the ordering of two
     * statements inside each handler.
     */
    let own: TestProject;
    let ownClientCookies: string[];
    let proposalId: string;

    beforeAll(async () => {
      const clientUser2 = await createTestUser(org.id, "client");
      ownClientCookies = await loginAs(app, org.slug, clientUser2);
      const client2 = await createTestClient(org.id, {
        status: "active", contactEmail: clientUser2.email, assignedPmUserId: pm.id,
      });
      own = await createTestProject(org.id, client2.id, {
        status: "client_review", assignedPmUserId: pm.id,
      });
      await addProjectMember(own.id, pm.id, "pm");
      await addProjectMember(own.id, clientUser2.id, "client");

      await request(app)
        .put(`/api/platform/projects/${own.id}/workspace`)
        .set("Cookie", pmCookies)
        .send({
          title: "v1",
          workspace: {
            booth: {
              width: 6, depth: 3, height: 2.5, system: "octanorm", companyName: "ACME",
              openFront: true, openBack: false, openLeft: false, openRight: false,
              fasciaEnabled: true, fasciaOption: "full",
            },
            themeIdx: 0, carpetIdx: 0, notes: [],
            placedItems: [
              { id: "s1", catalogId: "wall", name: "Wall", sku: "W", qty: 1, w: 1, d: 0.1, h: 2.5,
                color: "#ffffff", weight: 20, x: 1, z: 0, rotation: 0, kind: "structure" },
            ],
          },
        });

      const base = await request(app)
        .get(`/api/platform/projects/${own.id}/workspace`)
        .set("Cookie", pmCookies);
      await request(app)
        .put(`/api/platform/projects/${own.id}/workspace/proposal`)
        .set("Cookie", ownClientCookies)
        .send({ title: "proposal", workspace: { ...base.body.workspace, placedItems: [furniture] } });
      const submitted = await request(app)
        .post(`/api/platform/projects/${own.id}/workspace/proposal/submit`)
        .set("Cookie", ownClientCookies)
        .send({ note: "Ours, not theirs." });
      expect(submitted.status).toBe(200);
      proposalId = submitted.body.proposal.id as string;
    });

    it("cannot read a proposal on a project it does not own", async () => {
      const res = await request(app)
        .get(`/api/platform/projects/${own.id}/workspace/proposal`)
        .set("Cookie", foreignChiefCookies);
      expect(res.status).toBe(404);
    });

    it("cannot decide a proposal on a project it does not own", async () => {
      for (const decision of ["accept", "reject"]) {
        const res = await request(app)
          .post(`/api/platform/projects/${own.id}/workspace/proposal/${proposalId}/${decision}`)
          .set("Cookie", foreignChiefCookies)
          .send({ note: "x" });
        expect(res.status, decision).toBe(404);
      }

      // Still waiting for its own PM, untouched.
      const after = await request(app)
        .get(`/api/platform/projects/${own.id}/workspace/proposal`)
        .set("Cookie", pmCookies);
      expect(after.body.proposal.status).toBe("submitted");
    });
  });
});
