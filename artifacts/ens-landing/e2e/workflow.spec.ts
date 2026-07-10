/**
 * Three-role workflow test — proves the full platform lifecycle against the
 * real production backend (api-server + PostgreSQL).
 *
 * Flow proved end-to-end by API calls in beforeAll:
 *   1. Client signs up
 *   2. Chief approves client and assigns PM in one call
 *   3. PM creates project (auto-linked to "Workflow Co" client record)
 *   4. PM saves workspace draft
 *   5. PM submits workspace version → project moves to client_review
 *   6. Client approves workspace → project moves to approved
 *   7. Client sends message to PM
 *   8. Client reads message back to confirm it was saved
 *
 * Browser tests then assert the UI renders the correct state after the API flow.
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { clientUrl, grantStaffAccess } from "./helpers";

const ORG_SLUG = process.env.TEST_ORG_SLUG ?? "ens-demo-agency";
const RUN = Date.now();
const CHIEF_EMAIL = process.env.TEST_CHIEF_EMAIL ?? `workflow.chief.${RUN}@workflow.test`;
const CHIEF_PASSWORD = process.env.TEST_CHIEF_PASSWORD ?? "EnsDev2026!";
const PM_EMAIL = process.env.TEST_PM_EMAIL ?? `workflow.pm.${RUN}@workflow.test`;
const PM_PASSWORD = process.env.TEST_PM_PASSWORD ?? "EnsDev2026!";

let chiefCookie: string;
let pmCookie: string;
let clientCookie: string;
let clientEmail: string;
let projectId: string;
let pmUserId: string;
let uiMessageBody: string;

function extractCookie(res: Awaited<ReturnType<APIRequestContext["post"]>>) {
  return res.headers()["set-cookie"]?.split(";")[0] ?? "";
}

function authHeaders(cookie?: string) {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (cookie) h.cookie = cookie;
  return h;
}

async function apiPost(request: APIRequestContext, path: string, body: unknown, cookie?: string) {
  return request.post(`${API_URL}/api${path}`, { data: body, headers: authHeaders(cookie) });
}

async function apiPostAllowExisting(request: APIRequestContext, path: string, body: unknown) {
  const response = await apiPost(request, path, body);
  expect(
    response.ok() || response.status() === 409,
    `${path} failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
}

async function apiPut(request: APIRequestContext, path: string, body: unknown, cookie?: string) {
  return request.put(`${API_URL}/api${path}`, { data: body, headers: authHeaders(cookie) });
}

async function apiGet(request: APIRequestContext, path: string, cookie: string) {
  return request.get(`${API_URL}/api${path}`, { headers: { cookie } });
}

async function apiUpload(
  request: APIRequestContext,
  path: string,
  bytes: Buffer,
  fileName: string,
  cookie: string,
) {
  return request.post(`${API_URL}/api${path}`, {
    data: bytes,
    headers: {
      cookie,
      "content-type": "application/pdf",
      "x-file-name": fileName,
    },
  });
}

async function loginStaffPage(page: Page, email: string, password: string, target: RegExp) {
  await grantStaffAccess(page);
  await page.goto("/login");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-login").click();
  await page.waitForURL(target);
}

async function loginClientPage(page: Page, email: string, password: string) {
  await page.goto(clientUrl("/login"));
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-login").click();
  await page.waitForURL(/\/client/);
}

// Minimal valid workspace for testing the save/submit lifecycle
const MINIMAL_WORKSPACE = {
  booth: {
    width: 6,
    depth: 3,
    height: 2.5,
    system: "octanorm",
    companyName: "Workflow Co",
    openFront: true,
    openBack: false,
    openLeft: false,
    openRight: false,
  },
  themeIdx: 0,
  carpetIdx: 0,
  placedItems: [],
  notes: [],
};

test.describe("Three-role workflow", () => {
  test.beforeAll(async ({ request }) => {
    await apiPostAllowExisting(request, "/auth/signup-staff", {
      name: "Workflow Chief",
      company: "ENS Demo Agency",
      email: CHIEF_EMAIL,
      password: CHIEF_PASSWORD,
      role: "chief",
      organizationSlug: ORG_SLUG,
    });
    await apiPostAllowExisting(request, "/auth/signup-staff", {
      name: "Workflow PM",
      company: "ENS Demo Agency",
      email: PM_EMAIL,
      password: PM_PASSWORD,
      role: "pm",
      organizationSlug: ORG_SLUG,
    });

    // 1. Sign in as chief
    const chiefLogin = await apiPost(request, "/auth/login", {
      email: CHIEF_EMAIL, password: CHIEF_PASSWORD, organizationSlug: ORG_SLUG,
    });
    expect(chiefLogin.ok(), `chief login failed: ${await chiefLogin.text()}`).toBeTruthy();
    chiefCookie = extractCookie(chiefLogin);
    const chiefData = await chiefLogin.json();
    expect(chiefData.user.role).toBe("chief");

    // 2. Sign in as PM
    const pmLogin = await apiPost(request, "/auth/login", {
      email: PM_EMAIL, password: PM_PASSWORD, organizationSlug: ORG_SLUG,
    });
    expect(pmLogin.ok(), `PM login failed: ${await pmLogin.text()}`).toBeTruthy();
    pmCookie = extractCookie(pmLogin);
    const pmData = await pmLogin.json();
    expect(pmData.user.role).toBe("pm");
    pmUserId = pmData.user.id;

    // 3. Client signs up
    clientEmail = `e2e.client.${RUN}@workflow.test`;
    const clientSignup = await apiPost(request, "/auth/signup", {
      name: "Workflow Client",
      company: "Workflow Co",
      exhibitionName: `Workflow Expo ${RUN}`,
      boothSizeSqm: 18,
      preferredSystem: "Octanorm",
      city: "Istanbul",
      deadline: "2026-10-01",
      notes: "Automated E2E workflow test",
      email: clientEmail,
      password: "WorkflowClient2026!",
      organizationSlug: ORG_SLUG,
    });
    expect(clientSignup.ok(), `client signup failed: ${await clientSignup.text()}`).toBeTruthy();
    clientCookie = extractCookie(clientSignup);
    const clientData = await clientSignup.json();
    expect(clientData.user.role).toBe("client");

    // 4. Chief finds the pending client record and assigns it to a PM.
    const clientsList = await apiGet(request, "/platform/clients", chiefCookie);
    expect(clientsList.ok(), `clients list failed: ${await clientsList.text()}`).toBeTruthy();
    const { clients } = await clientsList.json();
    const newClient = clients.find((c: { contactEmail: string }) =>
      c.contactEmail?.toLowerCase() === clientEmail.toLowerCase(),
    );
    expect(newClient, "new client should appear in client list").toBeTruthy();

    const approveRes = await apiPut(
      request,
      "/platform/managers/assignments",
      {
        clientAssignments: [{ clientId: newClient.id, managerId: pmUserId }],
        projectAssignments: [],
        cascadeClientProjects: true,
      },
      chiefCookie,
    );
    expect(approveRes.ok(), `client assignment failed: ${await approveRes.text()}`).toBeTruthy();

    // 5. PM creates a project — "Workflow Co" matches the client record by company_name
    const projectRes = await apiPost(request, "/platform/projects", {
      name: `Workflow Project ${RUN}`,
      client: "Workflow Co",
      system: "octanorm",
      widthM: 6,
      depthM: 3,
      deadline: "2026-10-01",
    }, pmCookie);
    expect(projectRes.ok(), `project creation failed: ${await projectRes.text()}`).toBeTruthy();
    const { project } = await projectRes.json();
    projectId = project.id;
    expect(projectId).toBeTruthy();

    // 6. PM saves workspace draft
    const saveDraftRes = await apiPut(
      request,
      `/platform/projects/${projectId}/workspace`,
      { workspace: MINIMAL_WORKSPACE, title: "Workflow Draft" },
      pmCookie,
    );
    expect(saveDraftRes.ok(), `workspace draft save failed: ${await saveDraftRes.text()}`).toBeTruthy();

    // 7. PM submits workspace version → project transitions to client_review
    const submitRes = await apiPost(
      request,
      `/platform/projects/${projectId}/workspace/versions`,
      { workspace: MINIMAL_WORKSPACE, title: "Workflow Version 1", status: "submitted" },
      pmCookie,
    );
    expect(submitRes.ok(), `workspace version submit failed: ${await submitRes.text()}`).toBeTruthy();

    // 8. Client approves the workspace → project transitions to approved
    const changeRequestRes = await apiPost(
      request,
      `/platform/projects/${projectId}/change-requests`,
      { changeText: "Move the fascia branding to the center." },
      clientCookie,
    );
    expect(
      changeRequestRes.ok(),
      `client revision request failed: ${await changeRequestRes.text()}`,
    ).toBeTruthy();

    const revisedWorkspace = {
      ...MINIMAL_WORKSPACE,
      booth: {
        ...MINIMAL_WORKSPACE.booth,
        companyName: "Workflow Co Revised",
      },
    };
    const revisedDraftRes = await apiPut(
      request,
      `/platform/projects/${projectId}/workspace`,
      { workspace: revisedWorkspace, title: "Workflow Revised Draft" },
      pmCookie,
    );
    expect(
      revisedDraftRes.ok(),
      `revised workspace save failed: ${await revisedDraftRes.text()}`,
    ).toBeTruthy();

    const resubmitRes = await apiPost(
      request,
      `/platform/projects/${projectId}/workspace/versions`,
      { workspace: revisedWorkspace, title: "Workflow Version 2", status: "submitted" },
      pmCookie,
    );
    expect(
      resubmitRes.ok(),
      `workspace resubmission failed: ${await resubmitRes.text()}`,
    ).toBeTruthy();

    const approveWorkspaceRes = await apiPost(
      request,
      `/platform/projects/${projectId}/approve`,
      {},
      clientCookie,
    );
    expect(approveWorkspaceRes.ok(), `client workspace approval failed: ${await approveWorkspaceRes.text()}`).toBeTruthy();

    // 9. Client sends a message to PM (client→PM is the only allowed direction)
    const attachmentBytes = Buffer.from(`workflow attachment ${RUN}`, "utf8");
    const uploadRes = await apiUpload(
      request,
      "/platform/messages/attachments",
      attachmentBytes,
      `workflow-${RUN}.pdf`,
      clientCookie,
    );
    expect(uploadRes.ok(), `attachment upload failed: ${await uploadRes.text()}`).toBeTruthy();
    const { attachment } = await uploadRes.json();
    expect(attachment.id).toBeTruthy();

    const msgBody = `E2E workflow message ${RUN}`;
    const sendRes = await apiPost(request, `/platform/messages/${pmUserId}`, {
      body: msgBody,
      context: { projectId },
      attachments: [attachment],
    }, clientCookie);
    expect(sendRes.ok(), `client message send failed: ${await sendRes.text()}`).toBeTruthy();
    const { message } = await sendRes.json();
    // The returned message body is already decrypted
    expect(message.body, "sent message body should match").toBe(msgBody);

    // 10. Client reads back the conversation to confirm the message persisted
    const getRes = await apiGet(
      request,
      `/platform/messages/${pmUserId}?projectId=${encodeURIComponent(projectId)}`,
      clientCookie,
    );
    expect(getRes.ok(), `message fetch failed: ${await getRes.text()}`).toBeTruthy();
    const { messages } = await getRes.json();
    const found = (messages as Array<{ body: string }>).some((m) => m.body === msgBody);
    expect(found, "sent message must appear in the fetched conversation").toBeTruthy();

    const downloadRes = await apiGet(
      request,
      `/platform/messages/attachments/${attachment.id}`,
      pmCookie,
    );
    expect(downloadRes.ok(), `PM attachment download failed: ${await downloadRes.text()}`).toBeTruthy();
    expect(Buffer.from(await downloadRes.body()).equals(attachmentBytes)).toBeTruthy();

    uiMessageBody = `E2E client portal message ${RUN}`;
    const uiMessageRes = await apiPost(request, `/platform/messages/${pmUserId}`, {
      body: uiMessageBody,
      context: { projectId },
    }, clientCookie);
    expect(uiMessageRes.ok(), `UI message send failed: ${await uiMessageRes.text()}`).toBeTruthy();
  });

  // ── Browser tests ─────────────────────────────────────────────────────────────

  test("chief dashboard shows workflow queue", async ({ page }) => {
    await loginStaffPage(page, CHIEF_EMAIL, CHIEF_PASSWORD, /\/chief/);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/chief/);
    await expect(page.getByText(/dashboard|projects|workflow/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("chief clients page shows the approved workflow client", async ({ page }) => {
    await loginStaffPage(page, CHIEF_EMAIL, CHIEF_PASSWORD, /\/chief/);

    await page.goto("/chief/clients");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(`Workflow Project ${RUN}`, { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test("PM dashboard shows the created project", async ({ page }) => {
    await loginStaffPage(page, PM_EMAIL, PM_PASSWORD, /\/pm/);
    await page.waitForLoadState("networkidle");

    await page.goto("/pm/projects");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Workflow Project|Workflow Co/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("PM workspace loads for the submitted project", async ({ page }) => {
    await loginStaffPage(page, PM_EMAIL, PM_PASSWORD, /\/pm/);

    await page.goto(`/pm/workspace?projectId=${projectId}`);
    await page.waitForLoadState("networkidle");

    // No renderer error fallback visible
    await expect(page.getByText(/renderer did not respond/i)).not.toBeVisible({ timeout: 15_000 });

    const iframe = page.locator('iframe[title="Booth Renderer"]');
    await expect(iframe).toHaveAttribute("data-renderer-ready", "true", { timeout: 15_000 });
    const canvas = page.frameLocator('iframe[title="Booth Renderer"]').locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const canvasState = await canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement;
      return {
        width: target.width,
        height: target.height,
        imageLength: target.toDataURL("image/png").length,
      };
    });
    expect(canvasState.width, "canvas width must be > 100px").toBeGreaterThan(100);
    expect(canvasState.height, "canvas height must be > 100px").toBeGreaterThan(100);
    // A blank canvas (solid color) produces a very short data URL; a rendered booth has geometry
    expect(canvasState.imageLength, "booth canvas must not be blank").toBeGreaterThan(5_000);
  });

  test("renderer re-initializes after navigation away and back", async ({ page }) => {
    await loginStaffPage(page, PM_EMAIL, PM_PASSWORD, /\/pm/);

    // First load
    await page.goto(`/pm/workspace?projectId=${projectId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('iframe[title="Booth Renderer"]')).toHaveAttribute(
      "data-renderer-ready", "true", { timeout: 15_000 }
    );

    // Navigate away
    await page.goto("/pm/projects");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('iframe[title="Booth Renderer"]')).toHaveCount(0);

    // Navigate back — renderer must re-initialize without error
    await page.goto(`/pm/workspace?projectId=${projectId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/renderer did not respond/i)).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator('iframe[title="Booth Renderer"]')).toHaveAttribute(
      "data-renderer-ready", "true", { timeout: 15_000 }
    );
  });

  test("workspace state persists across reload: booth dimensions and company name", async ({ request }) => {
    const res = await apiGet(request, `/platform/projects/${projectId}/workspace`, pmCookie);
    expect(res.ok(), `workspace load failed: ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    // The beforeAll revised and resubmitted with companyName:"Workflow Co Revised"
    expect(body.workspace?.booth?.width, "booth width should be 6m").toBe(6);
    expect(body.workspace?.booth?.depth, "booth depth should be 3m").toBe(3);
    expect(body.workspace?.booth?.companyName, "company name should match revised submission").toBe("Workflow Co Revised");
    expect(body.workspace?.booth?.system, "booth system should be octanorm").toBe("octanorm");
    // Project should now be in approved state after client approved it
    expect(body.project?.status, "project status after approval").toMatch(/approved/i);
  });

  test("client sees workspace after approval (project is approved)", async ({ page }) => {
    await loginClientPage(page, clientEmail, "WorkflowClient2026!");
    await page.waitForLoadState("networkidle");

    await page.goto(clientUrl("/client/workspace"));
    await page.waitForLoadState("networkidle");

    const iframe = page.locator('iframe[title="Booth Renderer"]');
    await expect(iframe).toHaveAttribute("data-renderer-ready", "true", { timeout: 15_000 });
    await expect(
      page.frameLocator('iframe[title="Booth Renderer"]').locator("canvas").first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("client messages page shows the exact persisted message", async ({ page }) => {
    await loginClientPage(page, clientEmail, "WorkflowClient2026!");

    await page.goto(clientUrl("/client/messages"));
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: /search messages/i }).fill(PM_EMAIL);
    await page.getByRole("listitem").filter({ hasText: uiMessageBody }).click();
    await expect(page.getByText(uiMessageBody, { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
