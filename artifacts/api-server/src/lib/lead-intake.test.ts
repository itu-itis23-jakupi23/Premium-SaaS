import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  describeLeadIntakeFailure,
  isFatalLeadIntakeFailure,
  leadIntakeSlug,
  resolveLeadIntakeOrganization,
} from "./lead-intake";
import { createTestOrg, cleanupTestOrg, type TestOrg } from "../test/helpers";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, "..", "..");

describe("lead intake organization resolution", () => {
  let org: TestOrg;
  let previousSlug: string | undefined;

  beforeAll(async () => {
    org = await createTestOrg();
    previousSlug = process.env.DEFAULT_ORGANIZATION_SLUG;
  });

  afterAll(async () => {
    process.env.DEFAULT_ORGANIZATION_SLUG = previousSlug;
    await cleanupTestOrg(org.id);
  });

  it("reads the slug, treating blank as unset", () => {
    expect(leadIntakeSlug({ DEFAULT_ORGANIZATION_SLUG: " acme " })).toBe("acme");
    expect(leadIntakeSlug({ DEFAULT_ORGANIZATION_SLUG: "   " })).toBeNull();
    expect(leadIntakeSlug({})).toBeNull();
  });

  it("resolves a slug that names a live organization", async () => {
    const result = await resolveLeadIntakeOrganization({ DEFAULT_ORGANIZATION_SLUG: org.slug });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.organizationId).toBe(org.id);
  });

  it("reports an unknown slug as a configuration fault, not a database error", async () => {
    const result = await resolveLeadIntakeOrganization({
      DEFAULT_ORGANIZATION_SLUG: "definitely-not-an-organization",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unknown-organization");
    expect(describeLeadIntakeFailure(result)).toMatch(/no organization has that slug/i);
  });

  it("distinguishes an unset slug from an unknown one", async () => {
    const result = await resolveLeadIntakeOrganization({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unset");
    expect(describeLeadIntakeFailure(result)).toMatch(/is not set/i);
  });

  it("treats an empty database as a bootstrap state, not a misconfiguration", () => {
    // A deployment must be able to boot before the first organization exists,
    // so this case warns and continues where a wrong slug would stop the server.
    expect(isFatalLeadIntakeFailure("no-organizations", "production")).toBe(false);
    expect(isFatalLeadIntakeFailure("unknown-organization", "production")).toBe(true);
  });
});

/**
 * The assertion above is only worth anything if the entrypoint actually calls
 * it. Testing the helper in isolation would stay green if someone deleted the
 * call from index.ts - which is the same shape of blind spot that let the
 * original bug ship. So this boots the real entrypoint as a subprocess and
 * asserts it dies instead of serving.
 */
describe("server entrypoint refuses to start on a misconfigured slug", () => {
  /**
   * Boot the entrypoint on an ephemeral port (PORT=0 lets the OS choose), so a
   * run cannot collide with a leftover listener from a previous run - which it
   * did, because killing the shell wrapper on Windows leaves the node child
   * holding the socket. The tree kill below deals with that directly.
   */
  function boot(slug: string | null) {
    return new Promise<{ code: number | null; output: string }>((resolveBoot) => {
      // These assertions observe startup log messages, so an inherited silent
      // logging setting must not hide the evidence they need to inspect.
      const env = { ...process.env, PORT: "0", NODE_ENV: "test", LOG_LEVEL: "info" } as NodeJS.ProcessEnv;
      if (slug === null) delete env.DEFAULT_ORGANIZATION_SLUG;
      else env.DEFAULT_ORGANIZATION_SLUG = slug;

      const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
        cwd: serverRoot,
        env,
        shell: false,
      });

      let output = "";
      child.stdout.on("data", (d) => { output += String(d); });
      child.stderr.on("data", (d) => { output += String(d); });

      const stop = () => {
        if (child.pid === undefined) return;
        if (process.platform === "win32") {
          // SIGKILL reaches the shell, not the node process under it.
          spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        } else {
          child.kill("SIGKILL");
        }
      };

      // A correctly configured boot never exits on its own, so stop waiting
      // once it reports that it is listening and treat that as "started".
      //
      // The budget is deliberately generous. This spawns a real server that
      // connects to PostgreSQL, and it runs alongside twenty-three other test
      // files competing for the same database. At 25s it intermittently fired
      // before a *failing* boot had got as far as exiting, so the suite read
      // "never exited" as "started" and the assertion saw null instead of 1 -
      // a flaky release gate, which costs more than the seconds it saved.
      const timer = setTimeout(() => {
        stop();
        resolveBoot({ code: null, output });
      }, 45_000);

      const watch = setInterval(() => {
        if (/Server listening/.test(output)) {
          clearInterval(watch);
          clearTimeout(timer);
          stop();
          resolveBoot({ code: null, output });
        }
      }, 150);

      child.on("exit", (code) => {
        clearInterval(watch);
        clearTimeout(timer);
        resolveBoot({ code, output });
      });
    });
  }

  it("exits non-zero and names the problem when the slug matches no organization", async () => {
    // This test needs its own live organization: the previous suite already
    // cleaned up its fixture, and an empty database permits bootstrap startup.
    const org = await createTestOrg();
    try {
      const { code, output } = await boot("no-such-organization-slug");
      expect(code).toBe(1);
      expect(output).toMatch(/lead intake is misconfigured/i);
      expect(output).not.toMatch(/Server listening/);
    } finally {
      await cleanupTestOrg(org.id);
    }
  }, 90_000);

  it("starts normally when the slug resolves", async () => {
    const org = await createTestOrg();
    try {
      const { output } = await boot(org.slug);
      expect(output).toMatch(/Server listening/);
      expect(output).not.toMatch(/Refusing to start/i);
    } finally {
      await cleanupTestOrg(org.id);
    }
  }, 90_000);
});
