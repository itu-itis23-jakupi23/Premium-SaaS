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
import { clientUrl, grantStaffAccess, monitorPageFailures } from "./helpers";

const RUN = Date.now();
const ORG_SLUG = process.env.TEST_ORG_SLUG ?? `ens-workflow-${RUN}`;
const ORG_COMPANY = process.env.TEST_ORG_COMPANY ?? ORG_SLUG;
const WORKFLOW_EXHIBITION = `Workflow Expo ${RUN}`;
const WORKFLOW_PROJECT_NAME = `${WORKFLOW_EXHIBITION} - Workflow Co`;
const CHIEF_EMAIL = process.env.TEST_CHIEF_EMAIL ?? `workflow.chief.${RUN}@workflow.test`;
const CHIEF_PASSWORD = process.env.TEST_CHIEF_PASSWORD ?? "EnsDev2026!";
const PM_EMAIL = process.env.TEST_PM_EMAIL ?? `workflow.pm.${RUN}@workflow.test`;
const PM_PASSWORD = process.env.TEST_PM_PASSWORD ?? "EnsDev2026!";
const STAFF_SIGNUP_KEY = process.env.STAFF_SIGNUP_KEY ?? "";

let chiefCookie: string;
let pmCookie: string;
let clientCookie: string;
let clientEmail: string;
let projectId: string;
let editorProjectId: string;
let pmUserId: string;
let uiMessageBody: string;
const pageFailureAssertions = new WeakMap<Page, () => Promise<void>>();

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

async function apiPatch(request: APIRequestContext, path: string, body: unknown, cookie?: string) {
  return request.patch(`${API_URL}/api${path}`, { data: body, headers: authHeaders(cookie) });
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
  await page.waitForLoadState("networkidle");
}

async function loginClientPage(page: Page, email: string, password: string) {
  await page.goto(clientUrl("/login"));
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-login").click();
  await page.waitForURL(/\/client/);
}

async function expectBoothRendererHealthy(page: Page, label: string) {
  await expect(page.getByText(/renderer did not respond|3d renderer encountered an error/i)).toHaveCount(0);

  const iframe = page.locator('iframe[title="Booth Renderer"]');
  await expect(iframe, `${label}: iframe should become ready`).toHaveAttribute(
    "data-renderer-ready",
    "true",
    { timeout: 15_000 },
  );

  const frame = page.frameLocator('iframe[title="Booth Renderer"]');
  await expect(frame.locator("svg.scene"), `${label}: SVG scene should be visible`).toBeVisible({ timeout: 15_000 });
  await expect(frame.locator("canvas").first(), `${label}: GLB canvas should be visible`).toBeVisible({ timeout: 15_000 });

  const rendererState = await frame.locator("body").evaluate(() => {
    const svg = document.querySelector("svg.scene") as SVGSVGElement | null;
    const booth = document.getElementById("boothGroup");
    const floor = document.getElementById("floorGroup");
    const canvas = document.getElementById("glbCanvas") as HTMLCanvasElement | null;
    return {
      svgWidth: svg?.clientWidth ?? 0,
      svgHeight: svg?.clientHeight ?? 0,
      boothElements: booth?.querySelectorAll("path,polygon,line,rect,text").length ?? 0,
      floorElements: floor?.querySelectorAll("path,polygon,line,rect").length ?? 0,
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
    };
  });

  expect(rendererState.svgWidth, `${label}: SVG width must be > 100px`).toBeGreaterThan(100);
  expect(rendererState.svgHeight, `${label}: SVG height must be > 100px`).toBeGreaterThan(100);
  expect(rendererState.boothElements, `${label}: booth shell geometry must render`).toBeGreaterThan(20);
  expect(rendererState.floorElements, `${label}: floor/carpet geometry must render`).toBeGreaterThan(0);
  expect(rendererState.canvasWidth, `${label}: GLB canvas width must be > 100px`).toBeGreaterThan(100);
  expect(rendererState.canvasHeight, `${label}: GLB canvas height must be > 100px`).toBeGreaterThan(100);
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
  rooms: [{
    id: "workflow-storage-room",
    name: "Workflow storage room",
    width: 2,
    depth: 1,
    height: 2.5,
    x: 4.5,
    z: 1.5,
    hasDoor: true,
    hasCeiling: true,
    doorSide: "left",
    doorWidth: 0.75,
    doorPosition: "center",
    doorSwing: "left-in",
    doorOpen: false,
    wallFinish: "white",
    floorColor: "#1f2937",
    locked: false,
    designWall: "right",
    designFit: "contain",
  }],
  notes: [],
};

test.describe("Three-role workflow", () => {
  test.beforeEach(async ({ page }) => {
    pageFailureAssertions.set(page, monitorPageFailures(page));
  });

  test.afterEach(async ({ page }) => {
    await pageFailureAssertions.get(page)?.();
    pageFailureAssertions.delete(page);
  });

  test.beforeAll(async ({ request }) => {
    await apiPostAllowExisting(request, "/auth/signup-staff", {
      name: "Workflow Chief",
      company: ORG_COMPANY,
      email: CHIEF_EMAIL,
      password: CHIEF_PASSWORD,
      role: "chief",
      organizationSlug: ORG_SLUG,
      setupKey: STAFF_SIGNUP_KEY,
    });

    // 1. Sign in as chief
    const chiefLogin = await apiPost(request, "/auth/login", {
      email: CHIEF_EMAIL, password: CHIEF_PASSWORD, organizationSlug: ORG_SLUG,
    });
    expect(chiefLogin.ok(), `chief login failed: ${await chiefLogin.text()}`).toBeTruthy();
    chiefCookie = extractCookie(chiefLogin);
    const chiefData = await chiefLogin.json();
    expect(chiefData.user.role).toBe("chief");

    // 2. Chief invites the PM, then the PM activates and signs in.
    let pmLogin = await apiPost(request, "/auth/login", {
      email: PM_EMAIL, password: PM_PASSWORD, organizationSlug: ORG_SLUG,
    });
    if (!pmLogin.ok()) {
      const invitationResponse = await apiPost(request, "/platform/managers/invitations", {
        name: "Workflow PM",
        email: PM_EMAIL,
      }, chiefCookie);
      expect(invitationResponse.ok(), `PM invite failed: ${await invitationResponse.text()}`).toBeTruthy();
      const invitationData = await invitationResponse.json() as { invitation?: { token?: string } };
      expect(invitationData.invitation?.token, "PM invite should return an activation token").toBeTruthy();

      const acceptance = await apiPost(request, "/platform/managers/invitations/accept", {
        token: invitationData.invitation!.token,
        name: "Workflow PM",
        password: PM_PASSWORD,
      });
      expect(acceptance.ok(), `PM invitation acceptance failed: ${await acceptance.text()}`).toBeTruthy();

      pmLogin = await apiPost(request, "/auth/login", {
        email: PM_EMAIL, password: PM_PASSWORD, organizationSlug: ORG_SLUG,
      });
    }
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
      exhibitionName: WORKFLOW_EXHIBITION,
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

    const approveRes = await apiPatch(
      request,
      `/platform/clients/${newClient.id}/approve`,
      {
        managerId: pmUserId,
        confirmOverCapacity: true,
        overrideReason: "Approved by the complete browser workflow",
        note: "Approved and assigned by the complete browser workflow",
      },
      chiefCookie,
    );
    expect(approveRes.ok(), `client approval failed: ${await approveRes.text()}`).toBeTruthy();

    // 5. Approval creates the canonical intake project and assigns it to the PM.
    const projectsRes = await apiGet(request, "/platform/projects?limit=100", pmCookie);
    expect(projectsRes.ok(), `project list failed: ${await projectsRes.text()}`).toBeTruthy();
    const projectsPayload = await projectsRes.json() as {
      projects: Array<{ id: string; name: string; clientId?: string }>;
    };
    const project = projectsPayload.projects.find((candidate) => (
      candidate.name === WORKFLOW_PROJECT_NAME || candidate.clientId === newClient.id
    ));
    if (!project) {
      throw new Error(`Canonical intake project was not created for ${newClient.id}`);
    }
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

    // Keep editor interaction tests isolated from the approved client version.
    // Saving a UI regression fixture must never alter the lifecycle under test.
    const editorProjectRes = await apiPost(request, "/platform/projects", {
      name: `Workspace Editor ${RUN}`,
      client: "Workflow Co",
      system: "octanorm",
      widthM: 6,
      depthM: 3,
      deadline: "2026-10-02",
    }, pmCookie);
    expect(
      editorProjectRes.ok(),
      `editor project creation failed: ${await editorProjectRes.text()}`,
    ).toBeTruthy();
    editorProjectId = (await editorProjectRes.json()).project.id;

    const editorDraftRes = await apiPut(
      request,
      `/platform/projects/${editorProjectId}/workspace`,
      {
        workspace: {
          ...MINIMAL_WORKSPACE,
          booth: { ...MINIMAL_WORKSPACE.booth, companyName: "Workspace Editor" },
        },
        title: "Editor regression draft",
      },
      pmCookie,
    );
    expect(
      editorDraftRes.ok(),
      `editor workspace save failed: ${await editorDraftRes.text()}`,
    ).toBeTruthy();

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
    const clientRow = page.getByRole("row").filter({ hasText: "Workflow Co" });
    await expect(clientRow.getByText(WORKFLOW_EXHIBITION, { exact: true })).toBeVisible({ timeout: 10_000 });
    // The Assigned PM cell renders avatar initials next to the name, so match
    // on cell content rather than an exact standalone text node.
    await expect(clientRow).toContainText("Workflow PM");
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
    await expectBoothRendererHealthy(page, "PM workspace");
  });

  test("PM workspace currency switch updates prices and persists after reload", async ({ page }) => {
    await loginStaffPage(page, PM_EMAIL, PM_PASSWORD, /\/pm/);
    await page.goto(`/pm/workspace?projectId=${editorProjectId}`);
    await page.waitForLoadState("networkidle");
    await expectBoothRendererHealthy(page, "PM currency workspace");

    const currency = page.getByLabel("Display currency");
    await expect(currency).toHaveValue("USD");
    await currency.selectOption("EUR");
    await expect(currency).toHaveValue("EUR");
    await expect(page.getByText(/^EUR \d[\d,]*$/).last()).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("ens-display-currency"))).toBe("EUR");

    await page.reload({ waitUntil: "networkidle" });
    await expectBoothRendererHealthy(page, "PM currency workspace after reload");
    await expect(page.getByLabel("Display currency")).toHaveValue("EUR");
    await expect(page.getByText(/^EUR \d[\d,]*$/).last()).toBeVisible();
  });

  test("PM drags catalogue furniture onto a valid floor position and can undo it", async ({ page }) => {
    await loginStaffPage(page, PM_EMAIL, PM_PASSWORD, /\/pm/);
    await page.goto(`/pm/workspace?projectId=${editorProjectId}`);
    await page.waitForLoadState("networkidle");
    await expectBoothRendererHealthy(page, "PM catalogue drag workspace");

    const source = page.locator('[data-catalog-item-id="sedef-149"]');
    await source.scrollIntoViewIfNeeded();
    await expect(source).toHaveAttribute("data-catalog-draggable", "true");

    const sourceBox = await source.boundingBox();
    const iframe = page.locator('iframe[title="Booth Renderer"]');
    const iframeBox = await iframe.boundingBox();
    expect(sourceBox, "catalogue card should have a screen position").toBeTruthy();
    expect(iframeBox, "renderer iframe should have a screen position").toBeTruthy();

    const frame = page.frameLocator('iframe[title="Booth Renderer"]');
    const floorPoint = await frame.locator("body").evaluate(() => {
      const rendererWindow = window as typeof window & {
        project: (point: number[]) => { x: number; y: number } | null;
      };
      const svg = document.getElementById("scene") as SVGSVGElement;
      const projected = rendererWindow.project([-1.5, 0, 1.5]);
      if (!projected) throw new Error("Expected floor point to project into the renderer");
      const point = svg.createSVGPoint();
      point.x = projected.x;
      point.y = projected.y;
      const client = point.matrixTransform(svg.getScreenCTM()!);
      const rect = svg.getBoundingClientRect();
      return { x: client.x - rect.left, y: client.y - rect.top };
    });

    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 8, sourceBox!.y + sourceBox!.height / 2 + 8, { steps: 3 });
    await page.mouse.move(iframeBox!.x + floorPoint.x, iframeBox!.y + floorPoint.y, { steps: 16 });
    await expect(page.locator('[data-catalog-drop-zone="true"]')).toBeVisible();
    await page.mouse.up();

    await expect.poll(async () => frame.locator("body").evaluate(() => {
      const state = (window as typeof window & { __pendingGlbState?: { placedItems?: Array<{ catalogId?: string }> } }).__pendingGlbState;
      return state?.placedItems?.filter(item => item.catalogId === "sedef-149").length ?? 0;
    })).toBe(1);

    await page.getByTitle(/Undo \(Ctrl\+Z\)/).click();
    await expect.poll(async () => frame.locator("body").evaluate(() => {
      const state = (window as typeof window & { __pendingGlbState?: { placedItems?: Array<{ catalogId?: string }> } }).__pendingGlbState;
      return state?.placedItems?.filter(item => item.catalogId === "sedef-149").length ?? 0;
    })).toBe(0);
  });

  test("PM furniture deletion clears Three.js state and persists after reload", async ({ page, request }) => {
    await loginStaffPage(page, PM_EMAIL, PM_PASSWORD, /\/pm/);
    await page.goto(`/pm/workspace?projectId=${editorProjectId}`);
    await page.waitForLoadState("networkidle");
    await expectBoothRendererHealthy(page, "PM deletion workspace");

    const source = page.locator('[data-catalog-item-id="sedef-149"]');
    await source.scrollIntoViewIfNeeded();
    await source.click();

    const frame = page.frameLocator('iframe[title="Booth Renderer"]');
    const readPlacedItemId = () => frame.locator("body").evaluate(() => {
      const state = (window as typeof window & {
        __pendingGlbState?: { placedItems?: Array<{ id?: string; catalogId?: string }> };
      }).__pendingGlbState;
      return state?.placedItems?.find(item => item.catalogId === "sedef-149")?.id ?? "";
    });
    await expect.poll(readPlacedItemId).not.toBe("");
    const placedItemId = await readPlacedItemId();

    const removeButton = page.locator(`[data-workspace-remove-item="${placedItemId}"]`);
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    await expect.poll(async () => frame.locator("body").evaluate((id) => {
      const rendererWindow = window as typeof window & {
        __pendingGlbState?: { placedItems?: Array<{ id?: string }> };
        __glbVisibleItems?: Set<string>;
        __glbPhysicalBounds?: Map<string, unknown>;
      };
      return {
        inWorkspace: rendererWindow.__pendingGlbState?.placedItems?.some(item => item.id === id) ?? false,
        visible: rendererWindow.__glbVisibleItems?.has(id) ?? false,
        bounds: rendererWindow.__glbPhysicalBounds?.has(id) ?? false,
      };
    }, placedItemId)).toEqual({ inWorkspace: false, visible: false, bounds: false });

    await expect(page.getByText("UNSAVED CHANGES", { exact: true })).toBeVisible();
    await expect(page.getByText("SAVED", { exact: true })).toBeVisible({ timeout: 10_000 });

    const savedRes = await apiGet(
      request,
      `/platform/projects/${editorProjectId}/workspace`,
      pmCookie,
    );
    expect(savedRes.ok(), `saved editor workspace load failed: ${await savedRes.text()}`).toBeTruthy();
    const saved = await savedRes.json();
    expect(
      saved.workspace?.placedItems?.some((item: { id?: string }) => item.id === placedItemId) ?? false,
      "deleted furniture must not remain in PostgreSQL",
    ).toBe(false);

    await page.reload({ waitUntil: "networkidle" });
    await expectBoothRendererHealthy(page, "PM deletion workspace after reload");
    await expect.poll(async () => frame.locator("body").evaluate((id) => {
      const rendererWindow = window as typeof window & {
        __pendingGlbState?: { placedItems?: Array<{ id?: string }> };
        __glbVisibleItems?: Set<string>;
      };
      return {
        inWorkspace: rendererWindow.__pendingGlbState?.placedItems?.some(item => item.id === id) ?? false,
        visible: rendererWindow.__glbVisibleItems?.has(id) ?? false,
      };
    }, placedItemId)).toEqual({ inWorkspace: false, visible: false });
  });

  test("renderer re-initializes after navigation away and back", async ({ page }) => {
    await loginStaffPage(page, PM_EMAIL, PM_PASSWORD, /\/pm/);

    // First load
    await page.goto(`/pm/workspace?projectId=${editorProjectId}`);
    await page.waitForLoadState("networkidle");
    await expectBoothRendererHealthy(page, "PM workspace first load");

    // Navigate away
    await page.goto("/pm/projects");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('iframe[title="Booth Renderer"]')).toHaveCount(0);

    // Navigate back — renderer must re-initialize without error
    await page.goto(`/pm/workspace?projectId=${editorProjectId}`);
    await page.waitForLoadState("networkidle");
    await expectBoothRendererHealthy(page, "PM workspace reload");
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
    expect(body.workspace?.rooms, "configured room should survive draft, submit, revision, and approval").toEqual([
      expect.objectContaining({
        id: "workflow-storage-room",
        doorSide: "left",
        doorWidth: 0.75,
        hasCeiling: true,
        designWall: "right",
        designFit: "contain",
      }),
    ]);
    // Project should now be in approved state after client approved it
    expect(body.project?.status, "project status after approval").toMatch(/approved/i);
  });

  test("client sees workspace after approval (project is approved)", async ({ page }) => {
    await loginClientPage(page, clientEmail, "WorkflowClient2026!");
    await page.waitForLoadState("networkidle");

    await page.goto(clientUrl("/client/workspace"));
    await page.waitForLoadState("networkidle");
    await expectBoothRendererHealthy(page, "Client workspace");
  });

  test("client messages page shows the exact persisted message", async ({ page }) => {
    await loginClientPage(page, clientEmail, "WorkflowClient2026!");

    await page.goto(clientUrl("/client/messages"));
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: /search messages/i }).fill(PM_EMAIL);
    await page.getByRole("listitem").filter({ hasText: uiMessageBody }).click();
    await expect(
      page.getByLabel("Message thread").getByText(uiMessageBody, { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("PM messages page shows the exact project conversation", async ({ page }) => {
    await loginStaffPage(page, PM_EMAIL, PM_PASSWORD, /\/pm/);
    await page.goto("/pm/messages");
    await page.waitForLoadState("networkidle");

    await page.getByText(WORKFLOW_EXHIBITION, { exact: true }).click();
    await page.getByText("Workflow Client", { exact: true }).last().click();
    await expect(
      page.getByLabel("Message thread").getByText(uiMessageBody, { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Chief message thread exposes an accessible live conversation", async ({ page }) => {
    await loginStaffPage(page, CHIEF_EMAIL, CHIEF_PASSWORD, /\/chief/);
    await page.goto("/chief/messages");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: WORKFLOW_EXHIBITION, exact: true }).click();
    await page.getByRole("button", { name: /^Project Managers/ }).click();
    await page.getByRole("button", { name: "Workflow PM", exact: true }).click();
    await expect(page.getByRole("log", { name: "Message thread" })).toBeVisible({
      timeout: 10_000,
    });
  });
});
