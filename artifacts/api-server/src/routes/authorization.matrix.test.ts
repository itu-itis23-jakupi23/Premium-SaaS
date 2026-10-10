import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app";
import {
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

type Method = "get" | "post" | "put" | "patch" | "delete";
type Role = "chief" | "pm" | "client";

interface DenialCase {
  name: string;
  method: Method;
  path: string;
  denied: Role[];
  body?: unknown;
}

const cases: DenialCase[] = [
  // Client furniture proposals. The sandbox is the client's and the decision is
  // the PM's, so each half must refuse the other - the feature tests assert the
  // happy paths, this asserts the refusals and that none of it is reachable
  // unauthenticated.
  {
    name: "save a furniture proposal",
    method: "put",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/workspace/proposal",
    denied: ["chief", "pm"],
    body: { title: "x", workspace: {} },
  },
  {
    name: "submit a furniture proposal",
    method: "post",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/workspace/proposal/submit",
    denied: ["chief", "pm"],
    body: { note: "x" },
  },
  {
    name: "withdraw a furniture proposal",
    method: "post",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/workspace/proposal/withdraw",
    denied: ["chief", "pm"],
  },
  {
    name: "accept a furniture proposal",
    method: "post",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/workspace/proposal/00000000-0000-4000-8000-000000000002/accept",
    denied: ["client"],
  },
  {
    name: "reject a furniture proposal",
    method: "post",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/workspace/proposal/00000000-0000-4000-8000-000000000002/reject",
    denied: ["client"],
    body: { note: "x" },
  },
  // Escalation targets name the chiefs a client may write to, so staff have no
  // business reading the list.
  {
    name: "escalation targets",
    method: "get",
    path: "/api/platform/messages/escalation-targets",
    denied: ["chief", "pm"],
  },
  {
    name: "database status",
    method: "get",
    path: "/api/db/status",
    denied: ["pm", "client"],
  },
  {
    name: "system readiness",
    method: "get",
    path: "/api/platform/system/readiness",
    denied: ["pm", "client"],
  },
  {
    name: "client directory",
    method: "get",
    path: "/api/platform/clients",
    denied: ["client"],
  },
  {
    name: "client creation",
    method: "post",
    path: "/api/platform/clients",
    denied: ["pm", "client"],
    body: {},
  },
  {
    name: "client approval",
    method: "patch",
    path: "/api/platform/clients/00000000-0000-4000-8000-000000000001/approve",
    denied: ["pm", "client"],
    body: {},
  },
  {
    name: "manager directory",
    method: "get",
    path: "/api/platform/managers",
    denied: ["pm", "client"],
  },
  {
    name: "manager assignment",
    method: "put",
    path: "/api/platform/managers/assignments",
    denied: ["pm", "client"],
    body: {},
  },
  {
    name: "Chief report",
    method: "get",
    path: "/api/platform/reports/chief",
    denied: ["pm", "client"],
  },
  {
    name: "workspace monitor",
    method: "get",
    path: "/api/platform/workspaces/monitor",
    denied: ["pm", "client"],
  },
  {
    name: "calendar mutation",
    method: "post",
    path: "/api/platform/calendar/events",
    denied: ["pm", "client"],
    body: {},
  },
  {
    name: "task directory",
    method: "get",
    path: "/api/platform/tasks",
    denied: ["client"],
  },
  {
    name: "workspace save",
    method: "put",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/workspace",
    denied: ["client"],
    body: {},
  },
  {
    name: "workspace submit",
    method: "post",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/workspace/versions",
    denied: ["client"],
    body: {},
  },
  {
    name: "workspace approval",
    method: "post",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/approve",
    denied: ["pm"],
    body: {},
  },
  {
    name: "revision request",
    method: "post",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/change-requests",
    denied: ["pm"],
    body: {},
  },
  {
    name: "document creation",
    method: "post",
    path: "/api/platform/documents",
    denied: ["client"],
    body: {},
  },
  {
    name: "subscription request",
    method: "post",
    path: "/api/platform/projects/00000000-0000-4000-8000-000000000001/workspace/subscription-request",
    denied: ["pm"],
    body: {},
  },
];

describe("deny-by-default authorization matrix", () => {
  let organization: TestOrg;
  let foreignOrganization: TestOrg;
  let foreignProject: TestProject;
  let foreignClientId: string;
  let foreignChief: TestUser;
  const users = {} as Record<Role, TestUser>;
  const cookies = {} as Record<Role, string[]>;

  beforeAll(async () => {
    organization = await createTestOrg();
    for (const role of ["chief", "pm", "client"] as const) {
      users[role] = await createTestUser(organization.id, role);
      cookies[role] = await loginAs(
        app as Express,
        organization.slug,
        users[role],
      );
    }

    foreignOrganization = await createTestOrg();
    foreignChief = await createTestUser(foreignOrganization.id, "chief");
    const foreignClient = await createTestClient(foreignOrganization.id, {
      status: "active",
    });
    foreignClientId = foreignClient.id;
    foreignProject = await createTestProject(
      foreignOrganization.id,
      foreignClient.id,
    );
  });

  afterAll(async () => {
    await cleanupTestOrg(organization.id);
    await cleanupTestOrg(foreignOrganization.id);
  });

  for (const testCase of cases) {
    it(`${testCase.name} requires authentication`, async () => {
      const response = await send(testCase);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ error: { code: "auth_required" } });
    });

    for (const role of testCase.denied) {
      it(`${testCase.name} rejects ${role}`, async () => {
        const response = await send(testCase, cookies[role]);
        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          error: { code: "permission_denied" },
        });
      });
    }
  }

  for (const role of ["chief", "pm", "client"] as const) {
    it(`hides a foreign project workspace from ${role}`, async () => {
      const response = await request(app)
        .get(`/api/platform/projects/${foreignProject.id}/workspace`)
        .set("Cookie", cookies[role]);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: { code: "workspace_not_found" },
      });
    });
  }

  it("prevents a Chief from mutating a client in another organization", async () => {
    const response = await request(app)
      .put(`/api/platform/clients/${foreignClientId}`)
      .set("Cookie", cookies.chief)
      .send({
        companyName: "Cross-tenant mutation",
        contactName: "Forbidden mutation",
        contactEmail: "forbidden@example.test",
      });

    expect(response.status).toBe(404);
  });

  it("does not expose a foreign Chief as a message contact", async () => {
    const response = await request(app)
      .get(`/api/platform/messages/${foreignChief.id}`)
      .set("Cookie", cookies.chief);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: { code: "contact_not_found" },
    });
  });
});

function send(testCase: DenialCase, cookie?: string[]) {
  const agent = request(app)[testCase.method](testCase.path);
  if (cookie) agent.set("Cookie", cookie);
  if (testCase.body !== undefined && testCase.body !== null) {
    agent.send(testCase.body as string | object);
  }
  return agent;
}
