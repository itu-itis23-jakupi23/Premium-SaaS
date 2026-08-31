import { describe, expect, it } from "vitest";

import {
  normalizePipelineStage,
  pipelineStageFromProjectStatus,
  type PipelineStage,
} from "./pipeline-stage";

/**
 * Every member of the `project_status` enum in lib/db. Kept spelled out rather
 * than imported so that adding a status to the database breaks this list and
 * forces a decision about where it belongs on the board - which is exactly the
 * step that was missed when `cancelled` and `archived` were added.
 */
const PROJECT_STATUSES = [
  "draft",
  "planning",
  "in_design",
  "client_review",
  "revision",
  "approved",
  "delayed",
  "in_production",
  "completed",
  "cancelled",
  "archived",
] as const;

/**
 * Statuses that end a project's life. The pipeline-flow report holds the
 * current stage's span open until `now` for anything not closed, so a terminal
 * status landing anywhere else accrues time forever.
 */
const TERMINAL_STATUSES = ["approved", "completed", "cancelled", "archived"];

describe("pipelineStageFromProjectStatus", () => {
  it("returns a real stage for every status the database can hold", () => {
    const stages: PipelineStage[] = ["intake", "design", "review", "production", "closed"];
    for (const status of PROJECT_STATUSES) {
      expect(stages).toContain(pipelineStageFromProjectStatus(status));
    }
  });

  it("closes every terminal status", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(pipelineStageFromProjectStatus(status)).toBe("closed");
    }
  });

  it("keeps cancelled and archived projects out of the live pipeline", () => {
    // The regression this file exists for. Both fell through to "intake", so a
    // project cancelled a year ago reported as stuck in intake for 365 days,
    // topped the chief's slowest-projects list, and pulled the intake average
    // up with it.
    expect(pipelineStageFromProjectStatus("cancelled")).toBe("closed");
    expect(pipelineStageFromProjectStatus("archived")).toBe("closed");
  });

  it("leaves live statuses in the flow", () => {
    for (const status of PROJECT_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s))) {
      expect(pipelineStageFromProjectStatus(status)).not.toBe("closed");
    }
  });

  it("places each working status on its own stage", () => {
    expect(pipelineStageFromProjectStatus("draft")).toBe("intake");
    expect(pipelineStageFromProjectStatus("planning")).toBe("intake");
    expect(pipelineStageFromProjectStatus("in_design")).toBe("design");
    expect(pipelineStageFromProjectStatus("client_review")).toBe("review");
    expect(pipelineStageFromProjectStatus("revision")).toBe("review");
    expect(pipelineStageFromProjectStatus("in_production")).toBe("production");
  });

  it("keeps a delayed project in the flow rather than closing it", () => {
    // Its board position is not encoded in its status, so the intake fallback
    // is a guess - but it is live work and must keep accruing stage time.
    expect(pipelineStageFromProjectStatus("delayed")).toBe("intake");
  });

  it("falls back to intake for a status it has never seen", () => {
    expect(pipelineStageFromProjectStatus("some_future_status")).toBe("intake");
  });
});

describe("normalizePipelineStage", () => {
  it("accepts every stage the board can set", () => {
    for (const stage of ["intake", "design", "review", "production", "closed"]) {
      expect(normalizePipelineStage(stage)).toBe(stage);
    }
  });

  it("rejects anything else so the caller falls back to status", () => {
    expect(normalizePipelineStage(null)).toBeNull();
    expect(normalizePipelineStage("")).toBeNull();
    expect(normalizePipelineStage("Intake")).toBeNull();
    expect(normalizePipelineStage("in_production")).toBeNull();
  });
});
