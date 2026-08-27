import { describe, expect, it } from "vitest";
import {
  compareProjectRisk,
  daysUntil,
  destinationScore,
  planRebalance,
  projectRisk,
  NEVER_LOAD_PAST,
  OVERLOADED_AT,
} from "./rebalance";
import type { ManagedProject, ManagerSummary } from "./managers-model";

/**
 * The chief portal is 10,480 lines across ten files and had no unit tests,
 * because there was nothing to call: every decision sat inline in a component
 * next to toast calls and dialog state. This covers the one that assigns a
 * named person somebody else's project.
 */

/**
 * Local noon, deliberately: `daysUntil` builds its target as `${date}T12:00:00`,
 * which JavaScript reads in local time. Anchoring `now` to a UTC instant made
 * the day count depend on the runner's offset - it read 11 in UTC+2 and 10 in
 * UTC+3. Same construction on both sides, and the arithmetic is exact anywhere.
 */
const NOW = new Date("2026-06-01T12:00:00");

function project(over: Partial<ManagedProject> & { id: string }): ManagedProject {
  return {
    name: `Project ${over.id}`,
    clientId: "client-1",
    exhibition: "Spring Expo",
    managerId: null,
    status: "Active",
    progress: 40,
    deadline: "2026-09-01",
    system: "octanorm",
    ...over,
  };
}

function manager(over: Partial<ManagerSummary> & { id: string }): ManagerSummary {
  return {
    name: `Manager ${over.id}`,
    email: `${over.id}@ens.test`,
    role: "pm",
    rating: 4,
    status: "Active",
    workload: 50,
    activeProjects: [],
    allProjects: [],
    clients: [],
    delayedCount: 0,
    urgentCount: 0,
    nextDeadline: null,
    ...over,
  } as ManagerSummary;
}

describe("daysUntil", () => {
  it("counts whole days to a future date", () => {
    expect(daysUntil("2026-06-11", NOW)).toBe(10);
  });

  it("goes negative once the date has passed", () => {
    expect(daysUntil("2026-05-25", NOW)).toBeLessThan(0);
  });

  it("returns null rather than NaN for a date it cannot read", () => {
    // This is the one that matters. It feeds a sort comparator: NaN makes the
    // comparator return NaN, which leaves the sort order undefined, so the
    // "least critical project" could come back as any project at all.
    expect(daysUntil("", NOW)).toBeNull();
    expect(daysUntil("not-a-date", NOW)).toBeNull();
  });
});

describe("projectRisk", () => {
  it("treats a delayed project as far more urgent than a healthy one", () => {
    const delayed = project({ id: "a", status: "Delayed", deadline: "2026-09-01" });
    const healthy = project({ id: "b", status: "Active", deadline: "2026-09-01" });
    expect(projectRisk(delayed, NOW)).toBeGreaterThan(projectRisk(healthy, NOW));
  });

  it("treats a nearer deadline as more urgent", () => {
    const soon = project({ id: "a", deadline: "2026-06-05" });
    const later = project({ id: "b", deadline: "2026-12-05" });
    expect(projectRisk(soon, NOW)).toBeGreaterThan(projectRisk(later, NOW));
  });

  it("does not let an unreadable deadline register as urgent", () => {
    const unknown = project({ id: "a", deadline: "" });
    expect(Number.isNaN(projectRisk(unknown, NOW))).toBe(false);
    expect(projectRisk(unknown, NOW)).toBe(0);
  });
});

describe("planRebalance", () => {
  it("declines when the manager has no active colleague to hand work to", () => {
    const busy = manager({ id: "busy", workload: 95, activeProjects: [project({ id: "p1" })] });
    const away = manager({ id: "away", status: "On Leave", workload: 10 });
    expect(planRebalance("busy", [busy, away], NOW)).toEqual({ outcome: "no-target" });
  });

  it("declines for a manager who is not overloaded", () => {
    const steady = manager({ id: "steady", workload: OVERLOADED_AT - 1 });
    const spare = manager({ id: "spare", workload: 10 });
    const plan = planRebalance("steady", [steady, spare], NOW);
    expect(plan.outcome).toBe("not-overloaded");
  });

  it("acts at the overload threshold, not one past it", () => {
    const atLimit = manager({
      id: "at-limit",
      workload: OVERLOADED_AT,
      activeProjects: [project({ id: "p1" })],
    });
    const spare = manager({ id: "spare", workload: 10 });
    expect(planRebalance("at-limit", [atLimit, spare], NOW).outcome).toBe("move");
  });

  it("never hands work to someone at the ceiling", () => {
    const busy = manager({ id: "busy", workload: 95, activeProjects: [project({ id: "p1" })] });
    const alsoBusy = manager({ id: "also", workload: NEVER_LOAD_PAST });
    const plan = planRebalance("busy", [busy, alsoBusy], NOW);
    expect(plan.outcome, `${NEVER_LOAD_PAST}% is the ceiling, not a valid destination`).toBe("all-loaded");
  });

  it("prefers the manager with the most free capacity", () => {
    const busy = manager({ id: "busy", workload: 90, activeProjects: [project({ id: "p1" })] });
    const some = manager({ id: "some", workload: 60, rating: 5 });
    const lots = manager({ id: "lots", workload: 20, rating: 3 });
    const plan = planRebalance("busy", [busy, some, lots], NOW);
    expect(plan.outcome).toBe("move");
    if (plan.outcome !== "move") return;
    // Capacity carries 60% of the score, so 40 points of it beats two rating stars.
    expect(plan.target.id).toBe("lots");
  });

  it("breaks a capacity tie on rating", () => {
    const busy = manager({ id: "busy", workload: 90, activeProjects: [project({ id: "p1" })] });
    const weaker = manager({ id: "weaker", workload: 40, rating: 2 });
    const stronger = manager({ id: "stronger", workload: 40, rating: 5 });
    const plan = planRebalance("busy", [busy, weaker, stronger], NOW);
    if (plan.outcome !== "move") throw new Error(`expected a move, got ${plan.outcome}`);
    expect(plan.target.id).toBe("stronger");
  });

  it("hands over the least critical project, not the most", () => {
    // Handing over the urgent work is how a rebalance becomes a missed deadline.
    const urgent = project({ id: "urgent", status: "Delayed", deadline: "2026-06-03" });
    const calm = project({ id: "calm", status: "Active", deadline: "2026-12-01" });
    const busy = manager({ id: "busy", workload: 92, activeProjects: [urgent, calm] });
    const spare = manager({ id: "spare", workload: 20 });
    const plan = planRebalance("busy", [busy, spare], NOW);
    if (plan.outcome !== "move") throw new Error(`expected a move, got ${plan.outcome}`);
    expect(plan.project.id).toBe("calm");
  });

  it("still picks the least critical project when a deadline is unreadable", () => {
    // With NaN in the comparator the sort order is undefined, so this could
    // previously return the delayed project and hand over the urgent work.
    const urgent = project({ id: "urgent", status: "Delayed", deadline: "2026-06-02" });
    const broken = project({ id: "broken", status: "Active", deadline: "" });
    const busy = manager({ id: "busy", workload: 92, activeProjects: [urgent, broken] });
    const spare = manager({ id: "spare", workload: 20 });
    const plan = planRebalance("busy", [busy, spare], NOW);
    if (plan.outcome !== "move") throw new Error(`expected a move, got ${plan.outcome}`);
    expect(plan.project.id).toBe("broken");
  });

  it("reports having nothing to hand over rather than moving nothing", () => {
    const busy = manager({ id: "busy", workload: 95, activeProjects: [] });
    const spare = manager({ id: "spare", workload: 10 });
    const plan = planRebalance("busy", [busy, spare], NOW);
    expect(plan.outcome).toBe("no-project");
  });

  it("survives a roster where nobody holds a project", () => {
    // maxProjects would be 0 without its guard, and every score would be NaN.
    const busy = manager({ id: "busy", workload: 95, activeProjects: [project({ id: "p1" })] });
    const a = manager({ id: "a", workload: 10, activeProjects: [] });
    const b = manager({ id: "b", workload: 30, activeProjects: [] });
    const plan = planRebalance("busy", [busy, a, b], NOW);
    if (plan.outcome !== "move") throw new Error(`expected a move, got ${plan.outcome}`);
    expect(Number.isNaN(destinationScore(a, 1))).toBe(false);
    expect(plan.target.id).toBe("a");
  });
});

describe("compareProjectRisk", () => {
  it("sorts most critical first, so the last entry is the safest to move", () => {
    const urgent = project({ id: "urgent", status: "Delayed", deadline: "2026-06-02" });
    const middle = project({ id: "middle", status: "Active", deadline: "2026-06-20" });
    const calm = project({ id: "calm", status: "Active", deadline: "2026-12-01" });
    const sorted = [calm, urgent, middle].sort((a, b) => compareProjectRisk(a, b, NOW));
    expect(sorted.map((p) => p.id)).toEqual(["urgent", "middle", "calm"]);
  });
});
