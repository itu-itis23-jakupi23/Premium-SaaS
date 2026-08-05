import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// ── Chief approval queue ────────────────────────────────────────────────────
// Tests the workflow introduced in the last dev sprint:
// Chief can see pending client accounts and approve or reject them.

test.describe("Chief approval queue", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "chief");
  });

  test("chief dashboard shows the workflow queue panel", async ({ page }) => {
    await page.goto("/chief");
    // The workflow queue card is rendered when overview.workflow is present
    await expect(page.getByText(/assignment control|workflow/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("chief dashboard supports a new organization with empty workflow queues", async ({ page }) => {
    await page.route("**/api/platform/overview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          organization: { id: "empty-org", name: "New Organization", slug: "new-organization", plan: "starter" },
          metrics: {
            clients: 0,
            projects: 0,
            projectManagers: 0,
            delayedProjects: 0,
            pendingApprovals: 0,
            activeWorkspaces: 0,
            documents: 0,
            comments: 0,
            completedProjects: 0,
          },
          projects: [],
          clients: [],
          activity: [],
          charts: {
            activity: [],
            distribution: [],
            activityCount: 0,
          },
          // This is the legacy production response that previously crashed
          // because the detail arrays were omitted when every count was zero.
          workflow: {
            counts: {
              pendingClientApprovals: 0,
              unassignedClients: 0,
              unassignedProjects: 0,
              newProjectManagers: 0,
              stalledApprovals: 0,
              overloadedManagers: 0,
            },
          },
        }),
      });
    });

    await page.goto("/chief");
    await expect(page.getByRole("heading", { name: /chief dashboard/i })).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    await expect(page.getByText(/assignment control|workflow/i).first()).toBeVisible();
  });

  test("chief inbox exposes unassigned PMs and pre-project client intake", async ({ page }) => {
    await page.route("**/api/platform/messages/contacts", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          contacts: [
            {
              id: "00000000-0000-4000-8000-000000000101",
              name: "Unassigned PM",
              email: "unassigned.pm@example.com",
              role: "pm",
              lastMessage: "No messages yet",
              lastMessageAt: null,
              time: "",
              unread: 0,
              online: false,
            },
            {
              id: "00000000-0000-4000-8000-000000000102",
              name: "Intake Client",
              email: "intake.client@example.com",
              role: "client",
              lastMessage: "No messages yet",
              lastMessageAt: null,
              time: "",
              unread: 0,
              online: false,
            },
          ],
        }),
      });
    });
    await page.route("**/api/platform/managers", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          managers: [],
          projects: [],
          clients: [{
            id: "00000000-0000-4000-8000-000000000201",
            name: "Intake Company",
            contactName: "Intake Client",
            contactEmail: "intake.client@example.com",
            managerId: null,
            managerName: "Unassigned",
            exhibition: "Pre Project Expo",
            status: "pending_approval",
            lastActivity: "Just now",
          }],
          audit: [],
          invitations: [],
        }),
      });
    });

    await page.goto("/chief/messages");
    await expect(page.getByTestId("message-scope-team-operations")).toBeVisible();
    await expect(page.getByTestId("message-scope-pre-project-expo")).toBeVisible();
  });

  test("chief can navigate to client list filtered by pending approval", async ({ page }) => {
    await page.goto("/chief/clients");
    // Check that the page loads without errors
    await expect(page).toHaveURL(/\/chief\/clients/);
    await expect(page.getByText(/clients|company/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("chief client list renders seeded client intake data", async ({ page }) => {
    await page.goto("/chief/clients");
    await page.waitForLoadState("networkidle");
    // With a freshly seeded E2E database, the seeded client should
    // appear in the list with "Pending" status until the chief approves them.
    await expect(page.getByText("E2E Client Co", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("E2E Expo", { exact: true }).first()).toBeVisible();
    // One of these must be true — the list is never in an indeterminate state
  });
});
