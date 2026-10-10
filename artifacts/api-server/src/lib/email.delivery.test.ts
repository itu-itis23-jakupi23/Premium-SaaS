import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { providerSend } = vi.hoisted(() => ({ providerSend: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: providerSend };
  },
}));

describe("email provider delivery result", () => {
  beforeEach(() => {
    vi.resetModules();
    providerSend.mockReset();
    vi.stubEnv("RESEND_API_KEY", "re_unit_test_secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function send() {
    const { sendPasswordResetEmail } = await import("./email");
    return sendPasswordResetEmail({
      to: "disposable@test.local", name: "Test recipient",
      resetUrl: "https://example.test/reset-password?token=disposable-token",
    });
  }

  it("reports accepted mail only when the provider returns a message id", async () => {
    providerSend.mockResolvedValue({ data: { id: "message-123" }, error: null });
    expect(await send()).toEqual({ ok: true, status: "sent" });
    expect(providerSend).toHaveBeenCalledOnce();
    expect(providerSend).toHaveBeenCalledWith(expect.objectContaining({
      to: "disposable@test.local", subject: "Reset your password - ENS Agency",
      html: expect.stringContaining("https://example.test/reset-password?token=disposable-token"),
    }));
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each(["validation_error", "invalid_api_key", "rate_limit_exceeded", "application_error"])("reports a resolved %s failure", async (name) => {
    providerSend.mockResolvedValue({ data: null, error: { name, message: "Provider rejected the message" } });
    expect(await send()).toEqual({ ok: false, status: "failed", error: "Provider rejected the message" });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "Provider rejected the message");
  });

  it.each([
    { data: null, error: null },
    { data: {}, error: null },
    { data: { id: "" }, error: null },
    { data: { id: "  " }, error: null },
    undefined,
  ])("reports a response without a usable message id as failed", async (response) => {
    providerSend.mockResolvedValue(response);
    expect(await send()).toEqual({ ok: false, status: "failed", error: "Email provider did not confirm message acceptance" });
  });

  it.each(["resolved", "rejected"])("redacts secrets from a %s provider error and logs only the sanitized message", async (mode) => {
    const message = "Key re_unit_test_secret rejected\nwith sk_live_test_secret";
    if (mode === "resolved") providerSend.mockResolvedValue({ data: null, error: { name: "invalid_api_key", message } });
    else providerSend.mockRejectedValue(new Error(message));
    const sanitized = "Key [redacted] rejected with [redacted]";
    expect(await send()).toEqual({ ok: false, status: "failed", error: sanitized });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), sanitized);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("re_unit_test_secret");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("sk_live_test_secret");
  });

  it("caps provider error detail before returning or logging it", async () => {
    providerSend.mockResolvedValue({ data: null, error: { name: "application_error", message: "x".repeat(1000) } });
    expect(await send()).toEqual({ ok: false, status: "failed", error: "x".repeat(500) });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "x".repeat(500));
  });

  it("does not call the provider when delivery is unconfigured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await send()).toEqual({ ok: false, status: "skipped", error: "RESEND_API_KEY is not configured" });
    expect(providerSend).not.toHaveBeenCalled();
  });
});
