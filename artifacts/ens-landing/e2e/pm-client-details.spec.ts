import { test, expect, type Page } from "@playwright/test";
import { clientUrl, grantStaffAccess } from "./helpers";

const CLIENT_ID = "00000000-0000-4000-8000-000000000201";
const PORTAL_USER_ID = "00000000-0000-4000-8000-000000000301";
const PROJECT_ID = "00000000-0000-4000-8000-000000000401";
const clientFixture = {
  id: CLIENT_ID,
  userId: PORTAL_USER_ID as string | null,
  projectId: PROJECT_ID,
  name: "Fixture Booth Client",
  company: "Fixture Booth Client",
  contactName: "Fixture Contact",
  contactEmail: "fixture.client@example.test",
  pm: "Fixture PM",
  exhibition: "Fixture Expo",
  status: "Active",
  lastActivity: "Today",
};
const summaryFixture = {
  balances: [
    { currency: "USD", billedCents: 123450, receivedCents: 50000, outstandingCents: 73450, invoiceCount: 3 },
    { currency: "EUR", billedCents: 50000, receivedCents: 50000, outstandingCents: 0, invoiceCount: 1 },
  ],
  invoiceCount: 4,
};

interface Mutation {
  path: string;
  method: string;
  body: Record<string, unknown>;
}

interface FixtureState {
  mutations: Mutation[];
  unexpectedRequests: string[];
  pageErrors: string[];
  summaryRequests: number;
  releaseSummary: () => void;
}

const states = new WeakMap<Page, FixtureState>();

/** Every API request is fulfilled here; this spec never writes to a real database. */
async function setup(page: Page, options: {
  linked?: boolean;
  clipboardDenied?: boolean;
  rejectStatus?: boolean;
  holdSummary?: boolean;
  failSummaryOnce?: boolean;
  emptySummary?: boolean;
} = {}) {
  const client = { ...clientFixture, userId: options.linked === false ? null : PORTAL_USER_ID };
  const state: FixtureState = { mutations: [], unexpectedRequests: [], pageErrors: [], summaryRequests: 0, releaseSummary: () => {} };
  states.set(page, state);
  const summaryReady = options.holdSummary
    ? new Promise<void>((resolve) => { state.releaseSummary = resolve; })
    : Promise.resolve();
  page.on("pageerror", (error) => state.pageErrors.push(error.message));
  await grantStaffAccess(page);
  await page.addInitScript(() => localStorage.setItem("ens-lang", "en"));
  if (options.clipboardDenied) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("Clipboard permission denied")) },
      });
    });
  }
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      state.mutations.push({ path, method, body: request.postDataJSON() as Record<string, unknown> });
    }
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/api/auth/me") {
      return route.fulfill({ json: {
        user: { id: "00000000-0000-4000-8000-000000000101", name: "Fixture PM", email: "fixture.pm@example.test", role: "pm", systemRole: "pm" },
        organization: { id: "00000000-0000-4000-8000-000000000001", name: "Fixture Agency", slug: "fixture-agency", plan: "starter" },
        clientRecord: null,
      } });
    }
    if (path === "/api/platform/clients" && method === "GET") {
      return route.fulfill({ json: { clients: [client], pagination: { total: 1, limit: 25, offset: 0, hasMore: false }, summary: { total: 1, active: 1, needsSetup: client.userId ? 0 : 1 } } });
    }
    if (path === "/api/platform/account/settings") {
      return route.fulfill({ json: { profile: { name: "Fixture PM", email: "fixture.pm@example.test", avatarUrl: "" } } });
    }
    if (path === "/api/platform/notifications") {
      return route.fulfill({ json: { notifications: [], unread: 0 } });
    }
    if (path === "/api/platform/invoices/summary" && method === "GET") {
      expect(url.searchParams.get("clientId")).toBe(CLIENT_ID);
      state.summaryRequests++;
      await summaryReady;
      if (options.failSummaryOnce && state.summaryRequests === 1) {
        return route.fulfill({ status: 503, json: { error: { message: "Invoice summary temporarily unavailable." } } });
      }
      return route.fulfill({ json: options.emptySummary ? { balances: [], invoiceCount: 0 } : summaryFixture });
    }
    if (path === `/api/platform/clients/${CLIENT_ID}/status` && method === "PUT" && options.rejectStatus) {
      return route.fulfill({ status: 503, json: { error: { message: "Client status temporarily unavailable." } } });
    }
    if (path === `/api/platform/messages/${PORTAL_USER_ID}` && method === "POST") {
      return route.fulfill({ json: { message: { id: "fixture-message", body: request.postDataJSON().body, createdAt: "2026-10-10T00:00:00.000Z" } } });
    }
    state.unexpectedRequests.push(`${method} ${path}`);
    return route.abort("blockedbyclient");
  });
  await page.goto("/pm/clients");
  const opener = page.getByRole("row", { name: "Open client Fixture Booth Client" });
  await expect(opener).toBeVisible();
  await opener.focus();
  await opener.press("Enter");
  await expect(page.getByRole("dialog", { name: client.name })).toBeVisible();
  return state;
}

test.use({ locale: "en-US" });

test.afterEach(async ({ page }) => {
  const state = states.get(page);
  if (!state) return;
  state.releaseSummary();
  expect(state.unexpectedRequests, "All API traffic must stay inside this browser fixture").toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test("linked client accounts show the portal identity and safe recovery guidance", async ({ page }) => {
  const state = await setup(page);
  const drawer = page.getByRole("dialog", { name: clientFixture.name });
  await drawer.getByRole("button", { name: "Account", exact: true }).click();
  const account = page.getByTestId("client-portal-account");
  await expect(page.getByTestId("client-account-status")).toHaveText("Active portal account linked");
  await expect(page.getByTestId("client-account-id")).toHaveText(PORTAL_USER_ID);
  await expect(page.getByTestId("client-contact-email")).toHaveText(clientFixture.contactEmail);
  await expect(account).toContainText("Staff cannot view their passwords.");
  await expect(account).not.toContainText("EnsDev2026!");
  await expect(account).not.toContainText("MFA Disabled");
  await expect(account).not.toContainText("Web Browser (Chrome/Windows)");
  await expect(account.getByRole("button", { name: /show.*password|^show$/i })).toHaveCount(0);
  await expect(page.getByTestId("client-password-recovery-link")).toHaveAttribute("href", clientUrl("/forgot-password"));
  await expect(page.getByTestId("client-password-recovery-link")).toHaveAttribute("rel", "noopener noreferrer");
  expect(state.mutations).toEqual([]);
});

test("unlinked contact records do not claim a portal account or enable client messages", async ({ page }) => {
  const state = await setup(page, { linked: false });
  const drawer = page.getByRole("dialog", { name: clientFixture.name });
  await drawer.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByTestId("client-account-status")).toHaveText("No active portal account linked");
  await expect(page.getByTestId("client-account-id")).toHaveCount(0);
  await expect(page.getByTestId("client-password-recovery-link")).toHaveCount(0);
  await expect(page.getByTestId("client-portal-account")).toContainText("Ask the client to register");
  await expect(drawer.getByRole("button", { name: "Message", exact: true })).toBeDisabled();
  await drawer.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(drawer.getByRole("button", { name: "Send Workspace Link", exact: true })).toBeDisabled();
  expect(state.mutations).toEqual([]);
});

test("a denied clipboard request reports failure without claiming that an account ID was copied", async ({ page }) => {
  await setup(page, { clipboardDenied: true });
  await page.getByRole("dialog", { name: clientFixture.name }).getByRole("button", { name: "Account", exact: true }).click();
  await page.getByTestId("copy-portal-account-id").click();
  await expect(page.getByText("Could not copy. Select the value and copy it manually.", { exact: true })).toBeVisible();
  await expect(page.getByText("Copied", { exact: true })).toHaveCount(0);
});

test("a failed status change retains the confirmed client status and reports the failure", async ({ page }) => {
  const state = await setup(page, { rejectStatus: true });
  const status = page.getByLabel("Change client status", { exact: true });
  await status.selectOption("Inactive");
  await expect(page.getByText("Client status could not be updated.", { exact: true })).toBeVisible();
  await expect(status).toHaveValue("Active");
  expect(state.mutations).toEqual([{ path: `/api/platform/clients/${CLIENT_ID}/status`, method: "PUT", body: { status: "Inactive" } }]);
});

test("workspace messages use the client portal and the selected project's query parameter", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("dialog", { name: clientFixture.name }).getByRole("button", { name: "Send Workspace Link", exact: true }).click();
  await expect.poll(() => state.mutations.length).toBe(1);
  const message = state.mutations[0];
  expect(message.path).toBe(`/api/platform/messages/${PORTAL_USER_ID}`);
  expect(message.body.body).toContain(clientUrl(`/client/workspace?project=${PROJECT_ID}`));
  expect(message.body.body).not.toContain("projectId=");
  expect(message.body.body).not.toContain(new URL(page.url()).origin + "/client/");
});

test("billing displays actual currency balances and shares an invoice link without invented amounts", async ({ page }) => {
  const state = await setup(page, { holdSummary: true });
  await page.getByRole("dialog", { name: clientFixture.name }).getByRole("button", { name: "Billing", exact: true }).click();
  await expect(page.getByTestId("billing-summary-loading")).toBeVisible();
  await expect(page.getByTestId("billing-summary-row")).toHaveCount(0);
  state.releaseSummary();
  const usd = page.locator('[data-testid="billing-summary-row"][data-currency="USD"]');
  const eur = page.locator('[data-testid="billing-summary-row"][data-currency="EUR"]');
  await expect(page.getByTestId("billing-summary-row")).toHaveCount(2);
  await expect(usd.getByTestId("billing-billed")).toHaveText("$1,234.50");
  await expect(usd.getByTestId("billing-received")).toHaveText("$500.00");
  await expect(usd.getByTestId("billing-outstanding")).toHaveText("$734.50");
  await expect(eur.getByTestId("billing-billed")).toHaveText("€500.00");
  await expect(eur.getByTestId("billing-received")).toHaveText("€500.00");
  await expect(eur.getByTestId("billing-outstanding")).toHaveText("€0.00");
  await expect(page.getByRole("dialog", { name: clientFixture.name })).not.toContainText("$4,500.00");
  await page.getByTestId("share-client-invoices-link").click();
  await expect.poll(() => state.mutations.length).toBe(1);
  expect(state.mutations[0].body.body).toContain(clientUrl("/client/invoices"));
  expect(state.mutations[0].body.body).not.toMatch(/\$|€|4,500|2,800|1,700/);
});

test("billing summary failure can be retried and an empty ledger shows no fabricated balance", async ({ page }) => {
  const state = await setup(page, { failSummaryOnce: true, emptySummary: true });
  await page.getByRole("dialog", { name: clientFixture.name }).getByRole("button", { name: "Billing", exact: true }).click();
  await expect(page.getByTestId("billing-error")).toBeVisible();
  await expect(page.getByTestId("billing-summary-row")).toHaveCount(0);
  await expect(page.getByTestId("share-client-invoices-link")).toBeDisabled();
  await page.getByTestId("retry-billing-summary").click();
  await expect(page.getByTestId("billing-empty")).toBeVisible();
  await expect(page.getByTestId("billing-error")).toHaveCount(0);
  await expect(page.getByTestId("billing-summary-row")).toHaveCount(0);
  expect(state.summaryRequests).toBe(2);
  expect(state.mutations).toEqual([]);
});
