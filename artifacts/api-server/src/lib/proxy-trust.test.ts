import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import request from "supertest";
import type express from "express";

const runtimes = [
  ["production API", createRequire(import.meta.url)],
  ["development API", createRequire(new URL("../../../ens-landing/package.json", import.meta.url))],
] as const;

// Exercise the Express installations the two backends actually resolve. The
// lockfile alone cannot prove that runtime client-IP extraction uses the patch.
for (const [name, requireRuntime] of runtimes) {
  describe(`${name} proxy trust`, () => {
    const makeExpress = requireRuntime("express") as typeof express;
    it.each(["::ffff:10.0.0.0/8", "::/1"])("does not trust an IPv4 caller through the IPv6 subnet %s", async (subnet) => {
      const app = makeExpress();
      app.set("trust proxy", subnet);
      app.get("/ip", (req, res) => res.json({ ip: req.ip, ips: req.ips }));
      const result = await request(app).get("/ip").set("X-Forwarded-For", "198.51.100.77");
      expect(result.status).toBe(200);
      expect(result.body.ip).not.toBe("198.51.100.77");
      expect(result.body.ips).toEqual([]);
    });

    it("preserves forwarded client IPs from an explicitly trusted loopback proxy", async () => {
      const app = makeExpress();
      app.set("trust proxy", "loopback");
      app.get("/ip", (req, res) => res.json({ ip: req.ip }));
      const result = await request(app).get("/ip").set("X-Forwarded-For", "198.51.100.77");
      expect(result.status).toBe(200);
      expect(result.body.ip).toBe("198.51.100.77");
    });

    it("rejects invalid JSON body limits instead of silently accepting unlimited input", () => {
      expect(() => makeExpress.json({ limit: "not-a-size" })).toThrow();
    });

    it("rejects invalid form body limits instead of silently accepting unlimited input", () => {
      expect(() => makeExpress.urlencoded({ extended: true, limit: "not-a-size" })).toThrow();
    });

    it("accepts valid JSON while rejecting bodies above the configured limit", async () => {
      const app = makeExpress();
      app.use(makeExpress.json({ limit: "1kb" }));
      app.post("/body", (req, res) => res.json(req.body));
      const valid = await request(app).post("/body").send({ value: "small" });
      expect(valid.status).toBe(200);
      expect(valid.body).toEqual({ value: "small" });
      const oversized = await request(app).post("/body").send({ value: "x".repeat(2048) });
      expect(oversized.status).toBe(413);
    });
  });
}
