import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { API_URL } from "../playwright.config";

const CLIENT_BASE_URL = process.env.PLAYWRIGHT_CLIENT_BASE_URL ?? "http://localhost:5175";
const TEST_RUN_ID = process.env.TEST_RUN_ID ?? `local-${Date.now()}`;
const ORG_SLUG = process.env.TEST_ORG_SLUG ?? `ens-e2e-${TEST_RUN_ID}`;
const CHIEF_EMAIL = process.env.TEST_CHIEF_EMAIL ?? `chief.${TEST_RUN_ID}@e2e.test`;
const CHIEF_PASSWORD = process.env.TEST_CHIEF_PASSWORD ?? "EnsDev2026!";
const PM_EMAIL = process.env.TEST_PM_EMAIL ?? `pm.${TEST_RUN_ID}@e2e.test`;
const PM_PASSWORD = process.env.TEST_PM_PASSWORD ?? "EnsDev2026!";
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL ?? `client.${TEST_RUN_ID}@e2e.test`;
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD ?? "EnsDev2026!";
const STAFF_SIGNUP_KEY = process.env.STAFF_SIGNUP_KEY ?? "";

export const TEST_CREDS = {
  chief: { email: CHIEF_EMAIL, password: CHIEF_PASSWORD },
  pm: { email: PM_EMAIL, password: PM_PASSWORD },
  client: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
  orgSlug: ORG_SLUG,
};

export function clientUrl(path: string) {
  return new URL(path, CLIENT_BASE_URL).toString();
}

export async function grantStaffAccess(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("ens-staff-access-granted", "1");
  });
}

async function postAllowExisting(page: Page, path: string, data: Record<string, unknown>) {
  const response = await page.request.post(`${API_URL}/api${path}`, { data });
  if (response.ok() || response.status() === 409) return response;
  throw new Error(`${path} failed: ${response.status()} ${await response.text()}`);
}

export async function seedE2EAccounts(page: Page) {
  await postAllowExisting(page, "/auth/signup-staff", {
    name: "E2E Chief",
    company: ORG_SLUG,
    email: TEST_CREDS.chief.email,
    password: TEST_CREDS.chief.password,
    role: "chief",
    organizationSlug: ORG_SLUG,
    setupKey: STAFF_SIGNUP_KEY,
  });

  const chiefLogin = await page.request.post(`${API_URL}/api/auth/login`, {
    data: {
      email: TEST_CREDS.chief.email,
      password: TEST_CREDS.chief.password,
      organizationSlug: ORG_SLUG,
    },
  });
  if (!chiefLogin.ok()) {
    throw new Error(`Chief fixture login failed: ${chiefLogin.status()} ${await chiefLogin.text()}`);
  }

  const existingPmLogin = await page.request.post(`${API_URL}/api/auth/login`, {
    data: {
      email: TEST_CREDS.pm.email,
      password: TEST_CREDS.pm.password,
      organizationSlug: ORG_SLUG,
    },
  });
  if (!existingPmLogin.ok()) {
    let inviteResponse = await page.request.post(`${API_URL}/api/platform/managers/invitations`, {
      data: { name: "E2E PM", email: TEST_CREDS.pm.email },
    });

    if (inviteResponse.status() === 409) {
      const managerResponse = await page.request.get(`${API_URL}/api/platform/managers`);
      if (!managerResponse.ok()) {
        throw new Error(`Invitation lookup failed: ${managerResponse.status()} ${await managerResponse.text()}`);
      }
      const managerData = await managerResponse.json() as {
        invitations?: Array<{ id: string; email: string; status: string }>;
      };
      const pending = managerData.invitations?.find((invitation) => (
        invitation.email.toLowerCase() === TEST_CREDS.pm.email.toLowerCase() && invitation.status === "Pending"
      ));
      if (!pending) throw new Error("A PM invitation conflict was returned without a pending invitation");
      inviteResponse = await page.request.post(`${API_URL}/api/platform/managers/invitations/${pending.id}/resend`);
    }

    if (!inviteResponse.ok()) {
      throw new Error(`PM invitation failed: ${inviteResponse.status()} ${await inviteResponse.text()}`);
    }
    const inviteData = await inviteResponse.json() as { invitation?: { token?: string } };
    const token = inviteData.invitation?.token;
    if (!token) throw new Error("PM invitation did not return an activation token");

    const accepted = await page.request.post(`${API_URL}/api/platform/managers/invitations/accept`, {
      data: { token, name: "E2E PM", password: TEST_CREDS.pm.password },
    });
    if (!accepted.ok() && accepted.status() !== 409) {
      throw new Error(`PM invitation acceptance failed: ${accepted.status()} ${await accepted.text()}`);
    }
  }

  await postAllowExisting(page, "/auth/signup", {
    name: "E2E Client",
    company: "E2E Client Co",
    email: TEST_CREDS.client.email,
    password: TEST_CREDS.client.password,
    organizationSlug: ORG_SLUG,
    exhibition: "E2E Expo",
    boothWidthM: 6,
    boothDepthM: 3,
    preferredSystem: "Octanorm",
    venueCity: "Istanbul",
    targetDate: "2026-07-20",
    intakeNotes: "Seeded by Playwright E2E",
  });

  // Seeding uses the browser context's request client, which shares cookies
  // with the page. UI login tests must begin without a preselected role.
  await page.context().clearCookies();
}

export async function loginAs(page: Page, role: "chief" | "pm" | "client") {
  const creds = TEST_CREDS[role];
  await seedE2EAccounts(page);
  if (role === "chief" || role === "pm") {
    await grantStaffAccess(page);
  }
  await page.goto(role === "client" ? clientUrl("/login") : "/login");
  await page.getByTestId("input-email").fill(creds.email);
  await page.getByTestId("input-password").fill(creds.password);
  await page.getByTestId("button-login").click();
  // Wait for redirect to the role's dashboard
  await page.waitForURL(/\/(chief|pm|client)(\/|$)/);
}

export async function apiLogin(request: APIRequestContext, role: "chief" | "pm" | "client") {
  const creds = TEST_CREDS[role];
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: creds.email, password: creds.password, organizationSlug: ORG_SLUG },
  });
  return res.ok();
}

export function monitorPageFailures(page: Page) {
  const failures: string[] = [];

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/ResizeObserver|React DevTools|well-known\/appspecific/i.test(text)) return;
    failures.push(`console error: ${text}`);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (/\.well-known\/appspecific/i.test(url)) return;
    const errorText = request.failure()?.errorText ?? "";
    if (request.method() === "GET" && !url.includes("/api/") && errorText === "net::ERR_ABORTED") return;
    failures.push(`request failed: ${request.method()} ${url} ${errorText}`.trim());
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    if (response.status() < 400) return;
    if (response.status() === 401 && /\/api\/auth\/(me|refresh)(?:$|\?)/.test(url)) return;
    failures.push(`api ${response.status()}: ${response.request().method()} ${url}`);
  });

  return async () => {
    expect(failures, failures.join("\n")).toEqual([]);
  };
}
