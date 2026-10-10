import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { clientUrl } from "./helpers";

const workspace = {
  project: { id: "mobile-project", name: "Mobile review project", client: "Client", exhibition: "Autumn show", status: "Client Review", health: "On Track" },
  design: { id: "design", name: "Design", system: "octanorm", widthMm: 6000, depthMm: 3000, heightMm: 2500, currentVersionNumber: 2 },
  currentVersion: { id: "v2", versionNumber: 2, title: "Current design", snapshotUrl: "/review-preview.svg", status: "under_review", lockedAt: null },
  versions: [
    { id: "v2", versionNumber: 2, title: "Current design", snapshotUrl: "/review-preview.svg" },
    { id: "v1", versionNumber: 1, title: "Earlier design", snapshotUrl: "/review-preview.svg" },
  ],
  workspace: { booth: {}, placedItems: [], notes: [] }, readonly: true, revisionCount: 0, revisionLimit: 2, approved: false,
};

async function setup(page: Page, options: { failLoad?: boolean; failChange?: boolean; noPreview?: boolean; changed?: boolean } = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("ens-lang", "en"));
  let loads = 0;
  let approvals = 0;
  await page.route("**/review-preview.svg", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#ddd"/></svg>' }));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path.endsWith("/auth/me")) data = { user: { id: "client", name: "Client", email: "client@example.test", role: "client" }, organization: { name: "Agency", slug: "agency" }, clientRecord: { id: "client", status: "active" } };
    else if (path.endsWith("/notifications")) data = { notifications: [], unreadCount: 0 };
    else if (path.endsWith("/projects")) data = { projects: [{ id: workspace.project.id, name: workspace.project.name }], pagination: { hasMore: false } };
    else if (path.endsWith("/workspace/current") || path.endsWith("/workspace")) {
      loads++;
      if (options.failLoad && loads === 1) return route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } });
      data = structuredClone(workspace);
      if (options.noPreview) (data as typeof workspace).versions[0].snapshotUrl = "";
      if (options.changed && loads > 1) (data as typeof workspace).currentVersion.id = "v3";
    } else if (path.endsWith("/approve")) {
      approvals++;
      data = { ...workspace, approved: true, project: { ...workspace.project, status: "Approved" } };
    } else if (route.request().method() === "POST") {
      if (options.failChange) return route.fulfill({ status: 503, json: { error: "Please try again" } });
      data = { ...workspace, revisionCount: 1 };
    }
    await route.fulfill({ json: data });
  });
  await page.goto(clientUrl("/client/workspace"));
  return { approvals: () => approvals };
}

test("phone review loads without the CAD renderer and approves only after confirmation", async ({ page }) => {
  const state = await setup(page);
  await expect(page.getByTestId("mobile-client-review")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve Design", exact: true })).toBeEnabled();
  const evidence = resolve(import.meta.dirname, "../../../.release-evidence");
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: resolve(evidence, "mobile-client-review.png"), fullPage: true });
  await page.getByRole("button", { name: "Approve Design", exact: true }).click();
  expect(state.approvals()).toBe(0);
  await page.getByRole("button", { name: "Yes, Approve", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Design approved" })).toBeVisible();
  expect(state.approvals()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("failed workspace load can be retried", async ({ page }) => {
  await setup(page, { failLoad: true });
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: workspace.project.name })).toBeVisible();
});

test("failed change request retains the client's draft", async ({ page }) => {
  await setup(page, { failChange: true });
  await page.getByLabel("Request Design Changes", { exact: true }).fill("Please move the reception counter.");
  await page.getByRole("button", { name: "Send Request", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Request Design Changes", { exact: true })).toHaveValue("Please move the reception counter.");
});

test("missing previews and historical versions cannot be approved", async ({ page }) => {
  await setup(page, { noPreview: true });
  await expect(page.getByRole("button", { name: "Approve Design", exact: true })).toBeDisabled();
  await page.getByLabel("Select version").selectOption("v1");
  await expect(page.getByText("This is an earlier version.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Design", exact: true })).toBeDisabled();
});

test("a design replaced during confirmation is not approved", async ({ page }) => {
  const state = await setup(page, { changed: true });
  await page.getByRole("button", { name: "Approve Design", exact: true }).click();
  await page.getByRole("button", { name: "Yes, Approve", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("The design changed");
  expect(state.approvals()).toBe(0);
});

test("invoice loading failures offer a working retry on a phone", async ({ page }) => {
  await setup(page);
  let attempts = 0;
  await page.route("**/api/platform/invoices", (route) => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.fulfill({ json: { invoices: [] } });
  });
  await page.goto(clientUrl("/client/invoices"));
  await expect(page.getByRole("alert")).toContainText("Could not load the data");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(attempts).toBe(2);
});

test("temporary session-renewal failure keeps the client signed in for retry", async ({ page }) => {
  await setup(page);
  let attempts = 0;
  await page.route("**/api/platform/invoices", (route) => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 401, json: { error: "Access session expired" } }) : route.fulfill({ json: { invoices: [] } });
  });
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } }));
  await page.goto(clientUrl("/client/invoices"));
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/client\/invoices$/);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/client\/invoices$/);
  expect(attempts).toBe(2);
});

test("invoice background refresh stays visible and combines repeated focus events", async ({ page }) => {
  await setup(page);
  const invoice = {
    id: "quiet-invoice", invoiceNumber: "INV-QUIET", title: "Booth build", status: "open", currency: "USD",
    totalCents: 50000, subtotalCents: 50000, amountPaidCents: 0, discountCents: 0, taxCents: 0,
    dueAt: null, issuedAt: null, paidAt: null, lineItems: [],
  };
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/platform/invoices", async (route) => {
    requests++;
    if (requests > 1) await pending;
    await route.fulfill({ json: { invoices: [{ ...invoice, status: requests > 1 ? "paid" : "open" }] } });
  });
  await page.goto(clientUrl("/client/invoices"));
  const row = page.getByRole("button", { name: /INV-QUIET/ });
  await expect(row).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect.poll(() => requests).toBe(2);
  await expect(row).toBeVisible();
  release();
  await expect(row).toContainText("Paid");
  expect(requests).toBe(2);
});

test("outstanding invoice totals do not add different currencies together", async ({ page }) => {
  await setup(page);
  const invoice = {
    status: "open", title: "Booth build", totalCents: 10000, subtotalCents: 10000, amountPaidCents: 2500,
    discountCents: 0, taxCents: 0, dueAt: null, issuedAt: null, paidAt: null, lineItems: [],
  };
  await page.route("**/api/platform/invoices", (route) => route.fulfill({ json: { invoices: [
    { ...invoice, id: "usd-invoice", invoiceNumber: "INV-USD", currency: "USD" },
    { ...invoice, id: "eur-invoice", invoiceNumber: "INV-EUR", currency: "EUR", totalCents: 20000, amountPaidCents: 0 },
  ] } }));
  await page.goto(clientUrl("/client/invoices"));
  const balances = page.getByTestId("invoice-outstanding-balances");
  await expect(balances.locator("p")).toHaveCount(2);
  await expect(balances.locator("p").filter({ hasText: "USD" })).toContainText("75.00");
  await expect(balances.locator("p").filter({ hasText: "EUR" })).toContainText("200.00");
});

test("phone inbox allows contact switching and retains a failed-send draft", async ({ page }) => {
  await setup(page);
  await page.route("**/api/platform/messages/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/contacts")) return route.fulfill({ json: { contacts: [
      { id: "pm1", name: "First manager", email: "first@example.test", lastMessage: "Hello", unread: 0, time: "Today" },
      { id: "pm2", name: "Second manager", email: "second@example.test", lastMessage: "Hello", unread: 0, time: "Today" },
    ] } });
    if (path.endsWith("/escalation-targets")) return route.fulfill({ json: { targets: [] } });
    if (route.request().method() === "POST") return route.fulfill({ status: 503, json: { error: "Sending failed" } });
    return route.fulfill({ json: { conversationId: path, messages: [] } });
  });
  await page.goto(clientUrl("/client/messages"));
  const contacts = page.locator("#mobile-conversation");
  await expect(contacts).toBeVisible();
  await contacts.selectOption("pm2");
  await expect(page.getByText("Second manager", { exact: true }).last()).toBeVisible();
  const composer = page.locator('input[data-testid="input-message"], input[placeholder]').last();
  await composer.fill("Please confirm the deadline.");
  await expect(contacts).toBeDisabled();
  await composer.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Sending failed");
  await expect(composer).toHaveValue("Please confirm the deadline.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("dashboard guidance links to the client's next actions", async ({ page }) => {
  await setup(page);
  await page.route("**/api/platform/overview", (route) => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await page.goto(clientUrl("/client"));
  const guide = page.locator("details").filter({ hasText: "Your next steps" });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("link", { name: "2. Workspace" })).toHaveAttribute("href", "/client/workspace");
  await page.context().setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "You are offline" })).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "You are offline" })).toHaveCount(0);
});

test("dashboard guidance remembers the user's collapsed state", async ({ page }) => {
  await setup(page);
  await page.route("**/api/platform/overview", (route) => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await page.goto(clientUrl("/client"));
  const guide = page.locator("details").filter({ hasText: "Your next steps" });
  await expect(guide).toHaveJSProperty("open", true);
  await guide.locator("summary").click();
  await expect(guide).toHaveJSProperty("open", false);
  await page.goto(clientUrl("/client/workspace"));
  await page.goto(clientUrl("/client"));
  await expect(guide).toHaveJSProperty("open", false);
  await guide.locator("summary").click();
  await expect(guide.getByRole("link", { name: "2. Workspace" })).toBeVisible();
});
