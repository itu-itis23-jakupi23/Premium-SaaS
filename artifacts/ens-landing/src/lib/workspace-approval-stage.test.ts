import { describe, expect, it } from "vitest";
import {
  workspaceApprovalStage,
  workspaceApprovalStageLabel,
  type ProjectWorkspace,
  type WorkspaceApprovalStage,
} from "./platform-api";

/**
 * What the client is told about their design.
 *
 * This is a precedence chain over two status strings, matched by substring, and
 * it had no tests. Both properties matter and neither is obvious from reading
 * it: the *order* of the branches decides the answer when several could match,
 * and `includes()` means a value that merely contains another word wins a
 * branch it was never meant to.
 *
 * The statuses below are the real enum values, from migration 0000:
 *   booth_version_status: draft submitted under_review approved rejected
 *                         revision_requested locked
 *   project_status:       draft planning in_design client_review revision
 *                         approved delayed in_production completed cancelled
 *                         archived
 */

function workspace(over: {
  projectStatus?: string;
  versionStatus?: string;
  lockedAt?: string | null;
  submittedAt?: string | null;
  approved?: boolean;
}): ProjectWorkspace {
  return {
    project: { status: over.projectStatus ?? "planning" },
    currentVersion: {
      status: over.versionStatus ?? "draft",
      lockedAt: over.lockedAt ?? null,
      submittedAt: over.submittedAt ?? null,
    },
    approved: over.approved ?? false,
  } as unknown as ProjectWorkspace;
}

describe("workspaceApprovalStage", () => {
  it("falls back to draft when nothing has happened yet", () => {
    expect(workspaceApprovalStage(workspace({}))).toBe("draft");
  });

  it("treats a missing record as draft rather than throwing", () => {
    expect(workspaceApprovalStage(null)).toBe("draft");
    expect(workspaceApprovalStage(undefined)).toBe("draft");
  });

  it("reports a design that has been sent", () => {
    expect(workspaceApprovalStage(workspace({ versionStatus: "submitted" }))).toBe("sent");
    expect(workspaceApprovalStage(workspace({ submittedAt: "2026-06-01" }))).toBe("sent");
  });

  it("reports a design the client has opened", () => {
    expect(workspaceApprovalStage(workspace({ versionStatus: "under_review" }))).toBe("viewed");
  });

  it("reports an approved design from any of the three signals", () => {
    expect(workspaceApprovalStage(workspace({ approved: true }))).toBe("approved");
    expect(workspaceApprovalStage(workspace({ projectStatus: "approved" }))).toBe("approved");
    expect(workspaceApprovalStage(workspace({ versionStatus: "approved" }))).toBe("approved");
  });

  it("reports a revision request from either side", () => {
    expect(workspaceApprovalStage(workspace({ projectStatus: "revision" }))).toBe("revision_requested");
    expect(workspaceApprovalStage(workspace({ versionStatus: "revision_requested" }))).toBe(
      "revision_requested",
    );
  });

  it("tells a client their design was declined instead of calling it sent", () => {
    // routes/platform.ts writes 'rejected' to booth_version_status when an
    // approval is declined. There was no stage for it, so a declined design
    // fell through every branch and surfaced as "sent" - the client saw
    // "awaiting review" for a design that had been turned down.
    const declined = workspace({ versionStatus: "rejected", submittedAt: "2026-06-01" });
    expect(workspaceApprovalStage(declined)).toBe("rejected");
    expect(workspaceApprovalStageLabel("rejected")).toBe("Declined");
  });

  describe("precedence, where more than one branch could match", () => {
    it("locked beats everything, including approved", () => {
      const locked = workspace({
        lockedAt: "2026-06-01",
        approved: true,
        projectStatus: "revision",
        versionStatus: "rejected",
      });
      expect(workspaceApprovalStage(locked)).toBe("locked");
    });

    it("approved beats a lingering revision status", () => {
      // A project approved after a revision round carries both.
      const both = workspace({ projectStatus: "revision", versionStatus: "approved" });
      expect(workspaceApprovalStage(both)).toBe("approved");
    });

    it("declined beats sent, which is the whole point of having it", () => {
      const declined = workspace({ versionStatus: "rejected", submittedAt: "2026-06-01" });
      expect(workspaceApprovalStage(declined)).not.toBe("sent");
    });
  });

  describe("substring matching does not catch words it should not", () => {
    it("does not read a client_review project as approved or viewed", () => {
      // The obvious trap: "client_review" contains "review", and the viewed
      // branch tests for "under_review" rather than "review" precisely so this
      // does not match.
      expect(workspaceApprovalStage(workspace({ projectStatus: "client_review" }))).toBe("draft");
    });

    it("does not read in_production or completed as anything decided", () => {
      expect(workspaceApprovalStage(workspace({ projectStatus: "in_production" }))).toBe("draft");
      expect(workspaceApprovalStage(workspace({ projectStatus: "completed" }))).toBe("draft");
    });

    it("is not confused by case", () => {
      expect(workspaceApprovalStage(workspace({ projectStatus: "APPROVED" }))).toBe("approved");
      expect(workspaceApprovalStage(workspace({ versionStatus: "Rejected" }))).toBe("rejected");
    });
  });
});

describe("workspaceApprovalStageLabel", () => {
  it("names every stage, so a new one cannot ship unlabelled", () => {
    const stages: WorkspaceApprovalStage[] = [
      "draft",
      "sent",
      "viewed",
      "approved",
      "rejected",
      "revision_requested",
      "locked",
    ];
    for (const stage of stages) {
      const label = workspaceApprovalStageLabel(stage);
      expect(label, `${stage} has no label`).toBeTruthy();
      expect(label).not.toBe(stage);
    }
  });
});
