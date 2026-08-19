import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";

// The collector's contract is defensive-by-design: it must accept frontend
// error beacons without authentication and must always answer 204, even on
// malformed input, so a monitoring path can never make a broken page worse.
describe("POST /api/client-errors", () => {
  const validReport = {
    service: "ens-frontend",
    timestamp: new Date().toISOString(),
    path: "/pm/projects",
    userAgent: "Vitest/1.0",
    error: { message: "Cannot read properties of undefined", stack: "TypeError: ...\n at X" },
    context: { source: "react:PM Projects", componentStack: "at PMProjects" },
  };

  it("accepts a well-formed report without authentication and returns 204", async () => {
    const res = await request(app)
      .post("/api/client-errors")
      .set("content-type", "application/json")
      .send(validReport);
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });

  it("returns 204 for an empty body rather than erroring", async () => {
    const res = await request(app).post("/api/client-errors").send({});
    expect(res.status).toBe(204);
  });

  it("returns 204 for garbage / unexpected shapes", async () => {
    const res = await request(app)
      .post("/api/client-errors")
      .set("content-type", "application/json")
      .send({ error: "not-an-object", context: 42, path: 999 } as unknown as object);
    expect(res.status).toBe(204);
  });

  it("tolerates oversized fields (truncated server-side, never rejected)", async () => {
    const res = await request(app)
      .post("/api/client-errors")
      .set("content-type", "application/json")
      .send({ ...validReport, error: { message: "x".repeat(50_000), stack: "y".repeat(50_000) } });
    expect(res.status).toBe(204);
  });
});
