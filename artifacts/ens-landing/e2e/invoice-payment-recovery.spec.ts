import { test, expect, type Page, type Route } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { loginAs, TEST_CREDS } from "./helpers";

interface InvoiceFixture {
  id: string;
  invoiceNumber: string;
  totalCents: number;
  amountPaidCents: number;
  status: string;
}

interface Payment {
  id: string;
  amountCents: number;
  method: string;
  reference: string | null;
  note: string | null;
}

interface PaymentAttempt {
  key: string | undefined;
  actorId: string | undefined;
  organizationSlug: string | undefined;
  body: unknown;
}

async function createOpenInvoice(page: Page): Promise<InvoiceFixture> {
  const clientsResponse = await page.request.get(`${API_URL}/api/platform/clients?limit=100`);
  expect(clientsResponse.ok(), await clientsResponse.text()).toBeTruthy();
  const { clients } = await clientsResponse.json() as {
    clients: Array<{ id: string; contactEmail: string }>;
  };
  const client = clients.find((candidate) => candidate.contactEmail === TEST_CREDS.client.email);
  expect(client, "The authenticated organization's client fixture must exist").toBeDefined();

  const createResponse = await page.request.post(`${API_URL}/api/platform/invoices`, {
    data: {
      clientId: client!.id,
      title: `Payment recovery ${test.info().testId} ${Date.now()}`,
      currency: "USD",
      lineItems: [{ description: "Booth booking", quantity: 1, unitPriceCents: 10_000 }],
    },
  });
  expect(createResponse.status(), await createResponse.text()).toBe(201);
  const { invoice } = await createResponse.json() as { invoice: InvoiceFixture };
  const issueResponse = await page.request.post(`${API_URL}/api/platform/invoices/${invoice.id}/send`);
  expect(issueResponse.ok(), await issueResponse.text()).toBeTruthy();

  await page.goto("/chief/invoices");
  await expect(page.getByTestId(`partial-${invoice.invoiceNumber}`)).toBeVisible();
  return invoice;
}

async function paymentsFor(page: Page, invoiceId: string): Promise<Payment[]> {
  const response = await page.request.get(`${API_URL}/api/platform/invoices/${invoiceId}/payments`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json() as { payments: Payment[] }).payments;
}

async function invoiceFor(page: Page, invoiceId: string): Promise<InvoiceFixture> {
  const response = await page.request.get(`${API_URL}/api/platform/invoices/${invoiceId}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json() as { invoice: InvoiceFixture }).invoice;
}

function captureAttempt(route: Route): PaymentAttempt {
  return {
    key: route.request().headers()["idempotency-key"],
    actorId: route.request().headers()["x-payment-actor-id"],
    organizationSlug: route.request().headers()["x-payment-organization"],
    body: route.request().postDataJSON(),
  };
}

/** Commit against the real API, then lose only the browser's first response. */
async function loseFirstSuccessfulResponse(page: Page, url: string, status: number) {
  const attempts: PaymentAttempt[] = [];
  await page.route(url, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts.push(captureAttempt(route));
    const response = await route.fetch();
    expect(response.status(), await response.text()).toBe(status);
    if (attempts.length === 1) await route.abort("failed");
    else await route.fulfill({ response });
  });
  return attempts;
}

function expectSamePaymentRetry(attempts: PaymentAttempt[]) {
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toBeTruthy();
  expect(attempts[0].actorId).toBeTruthy();
  expect(attempts[0].organizationSlug).toBe(TEST_CREDS.orgSlug);
  expect(attempts[1]).toEqual(attempts[0]);
}

test.describe("Invoice payment recovery against the real ledger", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("ens-lang", "en"));
    await loginAs(page, "chief");
  });

  test("retrying a lost deposit response records the payment exactly once", async ({ page }) => {
    const invoice = await createOpenInvoice(page);
    const attempts = await loseFirstSuccessfulResponse(
      page,
      `${API_URL}/api/platform/invoices/${invoice.id}/payments`,
      201,
    );

    const opener = page.getByTestId(`partial-${invoice.invoiceNumber}`);
    await opener.focus();
    await opener.press("Enter");
    const dialog = page.getByTestId("invoice-payment-dialog");
    await expect(dialog).toBeVisible();
    await page.getByTestId("payment-amount").fill("35.00");
    await page.getByTestId("payment-method").selectOption("bank_transfer");
    await page.getByTestId("payment-reference").fill("BANK-DEPOSIT-35");
    await page.getByTestId("payment-note").fill("Received the booking deposit.");
    await page.getByTestId("confirm-invoice-payment").click();

    await expect(page.getByTestId("confirm-invoice-payment")).toHaveText(/Retry payment/);
    await expect(page.getByTestId("payment-amount")).toHaveValue("35.00");
    await expect(page.getByTestId("payment-amount")).toBeDisabled();
    await expect(page.getByTestId("payment-reference")).toHaveValue("BANK-DEPOSIT-35");
    await expect(page.getByTestId("payment-reference")).toBeDisabled();
    expect(await paymentsFor(page, invoice.id)).toEqual([
      expect.objectContaining({ amountCents: 3500, method: "bank_transfer", reference: "BANK-DEPOSIT-35", note: "Received the booking deposit." }),
    ]);

    await page.getByTestId("confirm-invoice-payment").click();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expectSamePaymentRetry(attempts);
    expect(await paymentsFor(page, invoice.id)).toHaveLength(1);
    expect(await invoiceFor(page, invoice.id)).toMatchObject({ amountPaidCents: 3500, status: "open" });
  });

  test("a confirmed full payment can be recovered after reload even when the invoice is already paid", async ({ page }) => {
    const invoice = await createOpenInvoice(page);
    const attempts = await loseFirstSuccessfulResponse(
      page,
      `${API_URL}/api/platform/invoices/${invoice.id}/mark-paid`,
      200,
    );

    const opener = page.getByTestId(`paid-${invoice.invoiceNumber}`);
    await opener.focus();
    await opener.press("Enter");
    let dialog = page.getByTestId("invoice-payment-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("$100.00");
    expect(await paymentsFor(page, invoice.id)).toEqual([]);
    expect(attempts).toEqual([]);
    await page.getByTestId("confirm-invoice-payment").click();
    await expect(page.getByTestId("confirm-invoice-payment")).toHaveText(/Retry payment/);
    expect(attempts[0].body).toEqual({ expectedAmountCents: 10_000 });
    expect(await invoiceFor(page, invoice.id)).toMatchObject({ amountPaidCents: 10_000, status: "paid" });

    await page.reload();
    dialog = page.getByTestId("invoice-payment-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(invoice.invoiceNumber);
    await expect(page.getByTestId("confirm-invoice-payment")).toHaveText(/Retry payment/);
    await page.getByTestId("confirm-invoice-payment").click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: /^Invoices\b/, level: 1 })).toBeFocused();
    expectSamePaymentRetry(attempts);
    expect(await paymentsFor(page, invoice.id)).toEqual([
      expect.objectContaining({ amountCents: 10_000 }),
    ]);
    expect(await invoiceFor(page, invoice.id)).toMatchObject({ amountPaidCents: 10_000, status: "paid" });
    await page.reload();
    await expect(page.getByRole("heading", { name: /^Invoices\b/, level: 1 })).toBeVisible();
    await expect(page.getByTestId("invoice-payment-dialog")).toBeHidden();
    await expect(page.getByTestId("resume-invoice-payment")).toHaveCount(0);
  });

  test("a server failure preserves the submitted payment details until a successful retry", async ({ page }) => {
    const invoice = await createOpenInvoice(page);
    const attempts: PaymentAttempt[] = [];
    await page.route(`${API_URL}/api/platform/invoices/${invoice.id}/payments`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attempts.push(captureAttempt(route));
      if (attempts.length === 1) {
        return route.fulfill({ status: 503, json: { error: { message: "Payment service temporarily unavailable." } } });
      }
      const response = await route.fetch();
      expect(response.status(), await response.text()).toBe(201);
      await route.fulfill({ response });
    });

    const opener = page.getByTestId(`partial-${invoice.invoiceNumber}`);
    await opener.focus();
    await opener.press("Enter");
    await page.getByTestId("payment-amount").fill("42.50");
    await page.getByTestId("payment-method").selectOption("cash");
    await page.getByTestId("payment-reference").fill("RECEIPT-42");
    await page.getByTestId("payment-note").fill("Cash received at the venue.");
    await page.getByTestId("confirm-invoice-payment").click();
    await expect(page.getByTestId("confirm-invoice-payment")).toHaveText(/Retry payment/);
    await expect(page.getByTestId("payment-amount")).toHaveValue("42.50");
    await expect(page.getByTestId("payment-method")).toHaveValue("cash");
    await expect(page.getByTestId("payment-reference")).toHaveValue("RECEIPT-42");
    await expect(page.getByTestId("payment-note")).toHaveValue("Cash received at the venue.");
    expect(await paymentsFor(page, invoice.id)).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("invoice-payment-dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: /^Invoices\b/, level: 1 })).toBeFocused();
    const resume = page.getByTestId("resume-invoice-payment");
    await resume.focus();
    await resume.press("Enter");
    await expect(page.getByTestId("invoice-payment-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("invoice-payment-dialog")).toBeHidden();
    await expect(resume).toBeFocused();
    await resume.press("Enter");
    await expect(page.getByTestId("payment-note")).toHaveValue("Cash received at the venue.");
    await page.getByTestId("confirm-invoice-payment").click();
    await expect(page.getByTestId("invoice-payment-dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: /^Invoices\b/, level: 1 })).toBeFocused();
    expectSamePaymentRetry(attempts);
    expect(await paymentsFor(page, invoice.id)).toEqual([
      expect.objectContaining({ amountCents: 4250, method: "cash", reference: "RECEIPT-42", note: "Cash received at the venue." }),
    ]);
  });

  test("a changed balance requires a fresh full-payment review before settlement", async ({ page }) => {
    const invoice = await createOpenInvoice(page);
    const attempts: PaymentAttempt[] = [];
    await page.route(`${API_URL}/api/platform/invoices/${invoice.id}/mark-paid`, async (route) => {
      attempts.push(captureAttempt(route));
      await route.continue();
    });

    await page.getByTestId(`paid-${invoice.invoiceNumber}`).click();
    await expect(page.getByTestId("invoice-payment-dialog")).toContainText("$100.00");
    // Another receipt arrives after the staff member reviewed the full balance.
    const depositResponse = await page.request.post(`${API_URL}/api/platform/invoices/${invoice.id}/payments`, {
      data: { amountCents: 3000, method: "bank_transfer", reference: "OTHER-RECEIPT" },
    });
    expect(depositResponse.status(), await depositResponse.text()).toBe(201);
    const refresh = page.waitForResponse((response) => (
      response.request().method() === "GET" && response.url() === `${API_URL}/api/platform/invoices`
    ));
    await page.getByTestId("confirm-invoice-payment").click();
    await expect(page.getByTestId("payment-error")).toContainText(/balance/i);
    await refresh;
    expect(await paymentsFor(page, invoice.id)).toEqual([
      expect.objectContaining({ amountCents: 3000, reference: "OTHER-RECEIPT" }),
    ]);
    expect(await invoiceFor(page, invoice.id)).toMatchObject({ amountPaidCents: 3000, status: "open" });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("invoice-payment-dialog")).toBeHidden();
    await page.getByTestId(`paid-${invoice.invoiceNumber}`).click();
    await expect(page.getByTestId("invoice-payment-dialog")).toContainText("$70.00");
    await page.getByTestId("confirm-invoice-payment").click();
    await expect(page.getByTestId("invoice-payment-dialog")).toBeHidden();
    expect(attempts).toHaveLength(2);
    expect(attempts[0].body).toEqual({ expectedAmountCents: 10_000 });
    expect(attempts[1].body).toEqual({ expectedAmountCents: 7000 });
    expect(attempts[0].key).toBeTruthy();
    expect(attempts[1].key).toBeTruthy();
    expect(attempts[1].key).not.toBe(attempts[0].key);
    expect((await paymentsFor(page, invoice.id)).map((payment) => payment.amountCents)).toEqual([3000, 7000]);
    expect(await invoiceFor(page, invoice.id)).toMatchObject({ amountPaidCents: 10_000, status: "paid" });
  });

  test("a failed list refresh keeps a confirmed payment recorded and retries only the list", async ({ page }) => {
    const invoice = await createOpenInvoice(page);
    const attempts: PaymentAttempt[] = [];
    let listRequests = 0;
    await page.route(`${API_URL}/api/platform/invoices`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      listRequests++;
      if (listRequests === 1) {
        return route.fulfill({ status: 503, json: { error: { message: "Invoice list temporarily unavailable." } } });
      }
      await route.fulfill({ response: await route.fetch() });
    });
    await page.route(`${API_URL}/api/platform/invoices/${invoice.id}/payments`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attempts.push(captureAttempt(route));
      const response = await route.fetch();
      expect(response.status(), await response.text()).toBe(201);
      await route.fulfill({ response });
    });

    await page.getByTestId(`partial-${invoice.invoiceNumber}`).click();
    await page.getByTestId("payment-amount").fill("25.00");
    await page.getByTestId("payment-reference").fill("CONFIRMED-RECEIPT");
    await page.getByTestId("confirm-invoice-payment").click();
    await expect(page.getByTestId("invoice-payment-dialog")).toBeHidden();
    await expect(page.getByText("Payment recorded", { exact: true })).toBeVisible();
    const listError = page.getByRole("alert").filter({ hasText: "The invoice list could not be refreshed" });
    await expect(listError).toBeVisible();
    const invoiceRow = page.getByRole("row").filter({ hasText: invoice.invoiceNumber });
    await expect(invoiceRow).toContainText("$75.00");
    await expect(page.getByTestId(`partial-${invoice.invoiceNumber}`)).toBeEnabled();
    await expect(page.getByTestId("resume-invoice-payment")).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("ens-invoice-payment:v1:")))).toEqual([]);
    expect(await paymentsFor(page, invoice.id)).toEqual([
      expect.objectContaining({ amountCents: 2500, reference: "CONFIRMED-RECEIPT" }),
    ]);

    await listError.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(listError).toBeHidden();
    await expect(invoiceRow).toContainText("$75.00");
    expect(listRequests).toBe(2);
    expect(attempts).toHaveLength(1);
    expect(await paymentsFor(page, invoice.id)).toHaveLength(1);
    expect(await invoiceFor(page, invoice.id)).toMatchObject({ amountPaidCents: 2500, status: "open" });
  });

  test("a stale tab cannot replay a payment under another staff member's session", async ({ page }) => {
    const invoice = await createOpenInvoice(page);
    const meResponse = await page.request.get(`${API_URL}/api/auth/me`, { headers: { "x-ens-portal": "staff" } });
    expect(meResponse.ok(), await meResponse.text()).toBeTruthy();
    const chief = await meResponse.json() as { user: { id: string } };
    const attempts: PaymentAttempt[] = [];
    await page.route(`${API_URL}/api/platform/invoices/${invoice.id}/payments`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attempts.push(captureAttempt(route));
      const response = await route.fetch();
      if (attempts.length === 2) {
        expect(response.status(), await response.text()).toBe(409);
        expect(await response.json()).toMatchObject({ error: { code: "payment_account_changed" } });
      } else {
        expect(response.status(), await response.text()).toBe(201);
      }
      if (attempts.length === 1) await route.abort("failed");
      else await route.fulfill({ response });
    });

    await page.getByTestId(`partial-${invoice.invoiceNumber}`).click();
    await page.getByTestId("payment-amount").fill("25.00");
    await page.getByTestId("payment-reference").fill("STALE-TAB-DEPOSIT");
    await page.getByTestId("confirm-invoice-payment").click();
    await expect(page.getByTestId("confirm-invoice-payment")).toHaveText(/Retry payment/);
    expect(await paymentsFor(page, invoice.id)).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ actorId: chief.user.id, organizationSlug: TEST_CREDS.orgSlug });

    // Another tab signs in as a different staff member; this page keeps its old review.
    const pmLogin = await page.request.post(`${API_URL}/api/auth/login`, {
      headers: { "x-ens-portal": "staff" },
      data: { ...TEST_CREDS.pm, organizationSlug: TEST_CREDS.orgSlug },
    });
    expect(pmLogin.ok(), await pmLogin.text()).toBeTruthy();
    const pm = await pmLogin.json() as { user: { id: string } };
    expect(pm.user.id).not.toBe(chief.user.id);
    await page.getByTestId("confirm-invoice-payment").click();
    await expect(page.getByTestId("payment-error")).toContainText(/account/i);
    await expect(page.getByTestId("payment-amount")).toBeDisabled();
    await expect(page.getByTestId("payment-amount")).toHaveValue("25.00");
    await expect(page.getByTestId("confirm-invoice-payment")).toHaveText(/Retry payment/);
    expectSamePaymentRetry(attempts);

    const chiefLogin = await page.request.post(`${API_URL}/api/auth/login`, {
      headers: { "x-ens-portal": "staff" },
      data: { ...TEST_CREDS.chief, organizationSlug: TEST_CREDS.orgSlug },
    });
    expect(chiefLogin.ok(), await chiefLogin.text()).toBeTruthy();
    expect((await chiefLogin.json() as { user: { id: string } }).user.id).toBe(chief.user.id);
    expect(await paymentsFor(page, invoice.id)).toEqual([
      expect.objectContaining({ amountCents: 2500, reference: "STALE-TAB-DEPOSIT" }),
    ]);

    await page.getByTestId("confirm-invoice-payment").click();
    await expect(page.getByTestId("invoice-payment-dialog")).toBeHidden();
    expect(attempts).toHaveLength(3);
    expect(attempts[2]).toEqual(attempts[0]);
    expect(await paymentsFor(page, invoice.id)).toHaveLength(1);
    expect(await invoiceFor(page, invoice.id)).toMatchObject({ amountPaidCents: 2500, status: "open" });
  });

  test("invalid precision and amounts above the balance never submit a payment", async ({ page }) => {
    const invoice = await createOpenInvoice(page);
    let submissions = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url() === `${API_URL}/api/platform/invoices/${invoice.id}/payments`) submissions++;
    });
    await page.getByTestId(`partial-${invoice.invoiceNumber}`).click();
    for (const amount of ["1.001", "101.00", "0.00", "-1.00"]) {
      await page.getByTestId("payment-amount").fill(amount);
      await page.getByTestId("confirm-invoice-payment").click();
      await expect(page.getByTestId("payment-error")).toBeVisible();
      await expect(page.getByTestId("payment-amount")).toBeEnabled();
      await expect(page.getByTestId("invoice-payment-dialog")).toBeVisible();
    }
    expect(submissions).toBe(0);
    expect(await paymentsFor(page, invoice.id)).toEqual([]);
  });
});
