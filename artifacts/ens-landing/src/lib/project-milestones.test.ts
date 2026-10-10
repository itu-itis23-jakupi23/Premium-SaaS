import { describe, expect, it } from "vitest";
import {
  PROJECT_MILESTONES,
  milestoneReached,
  projectMilestones,
} from "./project-milestones";

/**
 * The client dashboard's build milestones.
 *
 * This file exists because the dashboard carried two models of the same
 * journey. The step timeline used thresholds 1/35/65/85/95 for
 * created/designing/review/approved/production; the "approval progress" card
 * directly beneath it used 20/45/65 for the first three. Both read the same
 * `progress` number, so the page contradicted itself - at 30% the timeline
 * showed "created" complete while the card showed it outstanding.
 *
 * The agreement between the two is the thing worth pinning, so that is what
 * most of these assert.
 */
describe("project milestones", () => {
  it("is ordered, so the timeline reads left to right", () => {
    const thresholds = PROJECT_MILESTONES.map((milestone) => milestone.threshold);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
  });

  it("covers the five stages the dashboard labels", () => {
    expect(PROJECT_MILESTONES.map((milestone) => milestone.key)).toEqual([
      "created",
      "designing",
      "review",
      "approved",
      "production",
    ]);
  });

  it("agrees with the approval rows at every percentage", () => {
    // The regression this file is named for. `completed` in the timeline and
    // `done` in the approval card have to be the same predicate, checked over
    // the whole range rather than at a couple of convenient points.
    for (let progress = 0; progress <= 100; progress += 1) {
      const states = projectMilestones(progress);
      for (const milestone of states) {
        expect(
          milestone.state === "completed",
          `${milestone.key} at ${progress}%`,
        ).toBe(milestoneReached(milestone.key, progress));
      }
    }
  });

  it("completes nothing at zero and everything at a hundred", () => {
    expect(projectMilestones(0).every((m) => m.state !== "completed")).toBe(true);
    expect(projectMilestones(100).every((m) => m.state === "completed")).toBe(true);
  });

  it("never shows a later milestone ahead of an earlier one", () => {
    // A completed stage after a pending one would read as the build going
    // backwards.
    const rank = { completed: 2, active: 1, pending: 0 } as const;
    for (let progress = 0; progress <= 100; progress += 1) {
      const states = projectMilestones(progress).map((m) => rank[m.state]);
      for (let i = 1; i < states.length; i += 1) {
        expect(states[i], `progress ${progress}, step ${i}`).toBeLessThanOrEqual(states[i - 1]);
      }
    }
  });

  it("marks the next unreached milestone as the active one", () => {
    // `review` sits at 65, so at 50% it is what the project is working toward
    // and `designing` (35) is behind it.
    const states = Object.fromEntries(projectMilestones(50).map((m) => [m.key, m.state]));
    expect(states).toEqual({
      created: "completed",
      designing: "completed",
      review: "active",
      approved: "pending",
      production: "pending",
    });
  });

  it("has no active milestone left once the build is finished", () => {
    expect(projectMilestones(100).some((m) => m.state === "active")).toBe(false);
  });

  it("keeps at most one milestone active at a time", () => {
    // Two pulsing dots at once would be two answers to "where are we".
    for (let progress = 0; progress <= 100; progress += 1) {
      const active = projectMilestones(progress).filter((m) => m.state === "active");
      expect(active.length, `progress ${progress}`).toBeLessThanOrEqual(1);
    }
  });

  it("treats an unknown milestone as not reached", () => {
    // A typo in a call site must not silently claim a stage is complete.
    expect(milestoneReached("nonexistent" as never, 100)).toBe(false);
  });

  it("holds its invariants on a progress value outside 0-100", () => {
    // `progress` comes from the API and nothing here clamps it, so the
    // guarantees have to survive nonsense rather than the exact states being
    // pinned: a negative percentage has no meaningful answer.
    for (const progress of [-10, 1000, Number.NaN]) {
      const states = projectMilestones(progress);
      expect(states, `progress ${progress}`).toHaveLength(PROJECT_MILESTONES.length);
      expect(
        states.filter((m) => m.state === "active").length,
        `progress ${progress}`,
      ).toBeLessThanOrEqual(1);
    }
    expect(projectMilestones(-10).some((m) => m.state === "completed")).toBe(false);
    expect(projectMilestones(1000).every((m) => m.state === "completed")).toBe(true);
  });
});
