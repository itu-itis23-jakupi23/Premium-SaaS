import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClientSchema,
  updateClientSchema,
  pmTaskSchema,
  pmTaskPatchSchema,
} from "@workspace/api-zod";
import {
  createPlatformClient,
  updatePlatformClient,
  createPmTask,
  updatePmTask,
} from "./platform-api";

/**
 * The request bodies this app sends must satisfy the schemas the API parses.
 *
 * Two of the four production bugs found in the pre-deployment audit were
 * exactly this mismatch, and both were invisible locally:
 *
 *   creating a client sent name/company/email, while the API parses
 *   createClientSchema and wants companyName/contactName/contactEmail, so it
 *   answered 400 in production and worked against the dev backend, which had
 *   invented its own spelling;
 *
 *   creating a task sent the display priority ("High"/"Medium"/"Low"), which is
 *   what the API *returns*; what it *accepts* is the lowercase task_priority
 *   enum, and "medium" does not exist there at all.
 *
 * Nothing connected the two sides - the frontend did not even depend on the
 * package holding the contract. It does now, and these tests parse the real
 * outgoing body with the real schema, so a rename on either side fails here
 * rather than in front of a client.
 *
 * `fetch` is stubbed rather than mocking the api layer, so the body asserted on
 * is the one that would go over the wire.
 */

type Captured = { url: string; body: unknown };

let sent: Captured[] = [];

beforeEach(() => {
  sent = [];
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: RequestInit) => {
    sent.push({
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify({ clients: [], tasks: [], columns: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }));
  // The mock-API short circuit would return before any request is built.
  vi.stubEnv("VITE_USE_MOCK_API", "false");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** The body of the first request whose URL contains `fragment`. */
function bodyFor(fragment: string): unknown {
  const match = sent.find((entry) => entry.url.includes(fragment));
  expect(match, `no request was sent to a URL containing "${fragment}"`).toBeTruthy();
  return match!.body;
}

describe("client requests match the schema the API parses", () => {
  it("createPlatformClient sends a body createClientSchema accepts", async () => {
    await createPlatformClient({
      name: "Ada Lovelace",
      company: "Analytical Engines Ltd",
      email: "ada@example.com",
      exhibition: "Spring Expo",
    });

    const parsed = createClientSchema.safeParse(bodyFor("/platform/clients"));
    expect(parsed.success ? null : parsed.error.issues, "createClientSchema rejected the body")
      .toBeNull();
  });

  it("falls back to the contact name when no company is given", async () => {
    // companyName is required with min(1); the form leaves company optional, so
    // sending it through unchanged would fail on exactly the accounts a
    // salesperson creates in a hurry.
    await createPlatformClient({ name: "Ada Lovelace", company: "", email: "ada@example.com", exhibition: "" });

    const body = bodyFor("/platform/clients") as { companyName?: string };
    expect(body.companyName).toBe("Ada Lovelace");
    expect(createClientSchema.safeParse(body).success).toBe(true);
  });

  it("updatePlatformClient sends a body updateClientSchema accepts", async () => {
    await updatePlatformClient("client-1", {
      name: "Ada Lovelace",
      company: "Analytical Engines Ltd",
      email: "ada@example.com",
      exhibition: "Spring Expo",
    });

    const parsed = updateClientSchema.safeParse(bodyFor("/platform/clients/client-1"));
    expect(parsed.success ? null : parsed.error.issues, "updateClientSchema rejected the body")
      .toBeNull();
  });
});

describe("task requests match the schema the API parses", () => {
  const projectId = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

  it.each([
    ["High", "high"],
    ["Medium", "normal"],
    ["Low", "low"],
  ] as const)("createPmTask maps the %s display priority to %s", async (display, wire) => {
    await createPmTask({
      title: "Confirm freight",
      projectId,
      priority: display,
      deadline: "2026-10-01",
      status: "todo",
    });

    const body = bodyFor("/platform/tasks") as { priority?: string };
    expect(body.priority, `"${display}" must not reach the API unchanged`).toBe(wire);
    const parsed = pmTaskSchema.safeParse(body);
    expect(parsed.success ? null : parsed.error.issues, "pmTaskSchema rejected the body").toBeNull();
  });

  it("updatePmTask maps the priority too", async () => {
    await updatePmTask("task-1", { priority: "Medium" });

    const body = bodyFor("/platform/tasks/task-1") as { priority?: string };
    expect(body.priority).toBe("normal");
    expect(pmTaskPatchSchema.safeParse(body).success).toBe(true);
  });

  it("a patch that does not touch the priority does not invent one", async () => {
    // Spreading an absent key used to send priority: undefined, which JSON drops
    // - but a mapped undefined would have sent null and cleared it.
    await updatePmTask("task-2", { title: "Renamed only" });

    const body = bodyFor("/platform/tasks/task-2") as Record<string, unknown>;
    expect("priority" in body && body.priority !== undefined).toBe(false);
    expect(pmTaskPatchSchema.safeParse(body).success).toBe(true);
  });
});
