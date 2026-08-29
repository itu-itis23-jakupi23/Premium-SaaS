import { describe, expect, it } from "vitest";
import { isDelayedDashboardProject } from "./dashboard-risk";

/**
 * The chief reads this count to judge portfolio risk, so a project missing from
 * it is a project nobody looks at. Every case below uses real enum values from
 * migration 0000 - the bug was reading one enum's vocabulary out of the other's
 * field, which only shows up when the values are the real ones.
 */

const HEALTHS = ["on_track", "at_risk", "blocked", "delayed"] as const;

describe("isDelayedDashboardProject", () => {
  it("counts a project whose status is delayed", () => {
    expect(isDelayedDashboardProject("delayed", "on_track")).toBe(true);
  });

  it("counts a project whose health is at_risk", () => {
    expect(isDelayedDashboardProject("in_design", "at_risk")).toBe(true);
  });

  it("counts a blocked project", () => {
    // `blocked` is a health, and the check used to look for it in the status
    // string, where no value contains it. Blocked projects were absent from
    // the chief's delayed count entirely.
    expect(isDelayedDashboardProject("in_design", "blocked")).toBe(true);
  });

  it("counts a project whose health is delayed even when its status is not", () => {
    // Health was only ever tested for "risk", so this fell through too.
    expect(isDelayedDashboardProject("in_production", "delayed")).toBe(true);
  });

  it("leaves a healthy project out", () => {
    expect(isDelayedDashboardProject("in_design", "on_track")).toBe(false);
    expect(isDelayedDashboardProject("client_review", "on_track")).toBe(false);
    expect(isDelayedDashboardProject("completed", "on_track")).toBe(false);
  });

  it("flags every unhealthy health value, so a new one cannot slip through quietly", () => {
    const flagged = HEALTHS.filter((health) => isDelayedDashboardProject("in_design", health));
    expect(flagged).toEqual(["at_risk", "blocked", "delayed"]);
  });

  it("is not confused by case", () => {
    expect(isDelayedDashboardProject("DELAYED", "ON_TRACK")).toBe(true);
    expect(isDelayedDashboardProject("In_Design", "Blocked")).toBe(true);
  });
});
