import { describe, expect, it } from "vitest";
import {
  assignmentsSchema,
  createClientSchema,
  createProjectSchema,
  pipelineStageSchema,
  pmTaskSchema,
  updateClientSchema,
  updateProjectSchema,
} from "./platform";

describe("createProjectSchema", () => {
  it("accepts a minimal valid project", () => {
    const result = createProjectSchema.safeParse({
      name: "Hannover Messe Booth",
      client: "Acme GmbH",
      widthM: 6,
      depthM: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.system).toBe("octanorm");
      expect(result.data.deadline).toBeNull();
      expect(result.data.description).toBe("");
    }
  });

  it("rejects an empty name", () => {
    const result = createProjectSchema.safeParse({ name: "", client: "Acme", widthM: 6, depthM: 3 });
    expect(result.success).toBe(false);
  });

  it("rejects width outside 1-100m", () => {
    expect(createProjectSchema.safeParse({ name: "X", client: "Y", widthM: 0, depthM: 3 }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "X", client: "Y", widthM: 101, depthM: 3 }).success).toBe(false);
  });

  it("rejects a malformed deadline", () => {
    const result = createProjectSchema.safeParse({ name: "X", client: "Y", widthM: 6, depthM: 3, deadline: "06/30/2026" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid ISO deadline", () => {
    const result = createProjectSchema.safeParse({ name: "X", client: "Y", widthM: 6, depthM: 3, deadline: "2026-09-15" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid booth system", () => {
    const result = createProjectSchema.safeParse({ name: "X", client: "Y", widthM: 6, depthM: 3, system: "fancy" });
    expect(result.success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("accepts the literal 'unassigned' for managerId", () => {
    const result = updateProjectSchema.safeParse({ name: "X", client: "Y", widthM: 6, depthM: 3, managerId: "unassigned" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID, non-'unassigned' managerId", () => {
    const result = updateProjectSchema.safeParse({ name: "X", client: "Y", widthM: 6, depthM: 3, managerId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("pipelineStageSchema", () => {
  it("accepts each valid stage", () => {
    for (const stage of ["intake", "design", "review", "production", "closed"]) {
      expect(pipelineStageSchema.safeParse({ stage }).success).toBe(true);
    }
  });

  it("rejects an unknown stage", () => {
    expect(pipelineStageSchema.safeParse({ stage: "archived" }).success).toBe(false);
  });
});

describe("createClientSchema", () => {
  it("accepts a minimal client", () => {
    const result = createClientSchema.safeParse({ companyName: "Acme GmbH" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty company name", () => {
    expect(createClientSchema.safeParse({ companyName: "" }).success).toBe(false);
  });

  it("rejects a malformed contact email", () => {
    const result = createClientSchema.safeParse({ companyName: "Acme", contactEmail: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("defaults optional fields to null, not undefined", () => {
    const result = createClientSchema.safeParse({ companyName: "Acme" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contactName).toBeNull();
      expect(result.data.contactEmail).toBeNull();
      expect(result.data.exhibition).toBeNull();
    }
  });
});

describe("updateClientSchema", () => {
  it("requires both companyName and contactName", () => {
    expect(updateClientSchema.safeParse({ companyName: "Acme" }).success).toBe(false);
    expect(updateClientSchema.safeParse({ companyName: "Acme", contactName: "Jane" }).success).toBe(true);
  });
});

describe("assignmentsSchema", () => {
  it("defaults all arrays/flags when given an empty object", () => {
    const result = assignmentsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientAssignments).toEqual([]);
      expect(result.data.projectAssignments).toEqual([]);
      expect(result.data.cascadeClientProjects).toBe(false);
      expect(result.data.confirmOverCapacity).toBe(false);
    }
  });

  it("rejects a clientAssignments row with a non-UUID clientId", () => {
    const result = assignmentsSchema.safeParse({
      clientAssignments: [{ clientId: "not-a-uuid", managerId: null }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a null managerId (unassign)", () => {
    const result = assignmentsSchema.safeParse({
      clientAssignments: [{ clientId: "11111111-1111-4111-8111-111111111111", managerId: null }],
    });
    expect(result.success).toBe(true);
  });
});

describe("pmTaskSchema", () => {
  const validProjectId = "11111111-1111-4111-8111-111111111111";

  it("accepts a minimal task and applies defaults", () => {
    const result = pmTaskSchema.safeParse({ title: "Confirm freight", projectId: validProjectId });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("todo");
      expect(result.data.priority).toBe("normal");
    }
  });

  it("rejects a missing projectId", () => {
    expect(pmTaskSchema.safeParse({ title: "Confirm freight" }).success).toBe(false);
  });

  it("rejects an invalid priority", () => {
    const result = pmTaskSchema.safeParse({ title: "X", projectId: validProjectId, priority: "critical" });
    expect(result.success).toBe(false);
  });
});
