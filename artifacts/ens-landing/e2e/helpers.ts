import type { Page, APIRequestContext } from "@playwright/test";
import { API_URL } from "../playwright.config";

const ORG_SLUG = process.env.TEST_ORG_SLUG ?? "ens-demo-agency";
const CHIEF_EMAIL = process.env.TEST_CHIEF_EMAIL ?? "chief@demo.example";
const CHIEF_PASSWORD = process.env.TEST_CHIEF_PASSWORD ?? "EnsDev2026!";
const PM_EMAIL = process.env.TEST_PM_EMAIL ?? "pm@demo.example";
const PM_PASSWORD = process.env.TEST_PM_PASSWORD ?? "EnsDev2026!";
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL ?? "client@demo.example";
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD ?? "EnsDev2026!";

export const TEST_CREDS = {
  chief: { email: CHIEF_EMAIL, password: CHIEF_PASSWORD },
  pm: { email: PM_EMAIL, password: PM_PASSWORD },
  client: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
  orgSlug: ORG_SLUG,
};

export async function loginAs(page: Page, role: "chief" | "pm" | "client") {
  const creds = TEST_CREDS[role];
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  // Wait for redirect to the role's dashboard
  await page.waitForURL(/\/(chief|pm|client)\//);
}

export async function apiLogin(request: APIRequestContext, role: "chief" | "pm" | "client") {
  const creds = TEST_CREDS[role];
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: creds.email, password: creds.password, organizationSlug: ORG_SLUG },
  });
  return res.ok();
}
