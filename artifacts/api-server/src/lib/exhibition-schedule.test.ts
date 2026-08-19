import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  REQUIRED_LEAD_DAYS,
  SCHEDULE_TEMPLATE,
  leadTimeAssessment,
  planMilestones,
} from "./exhibition-schedule";

const now = new Date("2026-01-01T09:00:00.000Z");
const daysFromNow = (days: number) => new Date(now.getTime() + days * DAY_MS);
const keysOf = (milestones: { key: string }[]) => milestones.map(m => m.key);

describe("planMilestones — comfortable runway", () => {
  const dates = {
    moveInAt: daysFromNow(90),
    opensAt: daysFromNow(93),
    closesAt: daysFromNow(96),
    moveOutAt: daysFromNow(97),
  };

  it("plans the full chain plus the show window", () => {
    const plan = planMilestones(dates, { now });
    expect(keysOf(plan)).toEqual([
      ...SCHEDULE_TEMPLATE.map(entry => entry.key),
      "move_in", "show_open", "show_close", "move_out",
    ]);
  });

  it("places each internal milestone at its exact offset before move-in", () => {
    const plan = planMilestones(dates, { now });
    SCHEDULE_TEMPLATE.forEach(entry => {
      const milestone = plan.find(m => m.key === entry.key)!;
      const offsetDays = (dates.moveInAt.getTime() - milestone.dueAt.getTime()) / DAY_MS;
      expect(offsetDays).toBeCloseTo(entry.daysBeforeMoveIn);
    });
  });

  it("does not mark a comfortable plan as compressed", () => {
    expect(planMilestones(dates, { now }).every(m => !m.compressed)).toBe(true);
  });

  it("returns milestones in chronological order with dense sortOrder", () => {
    const plan = planMilestones(dates, { now });
    plan.forEach((milestone, index) => expect(milestone.sortOrder).toBe(index));
    for (let i = 1; i < plan.length; i += 1) {
      expect(plan[i].dueAt.getTime()).toBeGreaterThanOrEqual(plan[i - 1].dueAt.getTime());
    }
  });

  it("never plans anything after move-in", () => {
    const plan = planMilestones(dates, { now });
    const internal = plan.filter(m => SCHEDULE_TEMPLATE.some(entry => entry.key === m.key));
    internal.forEach(m => expect(m.dueAt.getTime()).toBeLessThanOrEqual(dates.moveInAt.getTime()));
  });
});

describe("planMilestones — short runway", () => {
  // Booked 21 days out; the template wants 42.
  const dates = { moveInAt: daysFromNow(21), opensAt: daysFromNow(24) };

  it("compresses the chain instead of emitting past dates", () => {
    const plan = planMilestones(dates, { now });
    plan.forEach(m => expect(m.dueAt.getTime()).toBeGreaterThanOrEqual(now.getTime()));
    expect(plan.filter(m => m.key !== "move_in" && m.key !== "show_open").every(m => m.compressed)).toBe(true);
  });

  it("keeps every step rather than dropping the ones that no longer fit", () => {
    const plan = planMilestones(dates, { now });
    SCHEDULE_TEMPLATE.forEach(entry => expect(keysOf(plan)).toContain(entry.key));
  });

  it("preserves the order of the chain when compressed", () => {
    const plan = planMilestones(dates, { now });
    const internal = plan.filter(m => SCHEDULE_TEMPLATE.some(entry => entry.key === m.key));
    for (let i = 1; i < internal.length; i += 1) {
      expect(internal[i].dueAt.getTime()).toBeGreaterThanOrEqual(internal[i - 1].dueAt.getTime());
    }
  });

  it("scales proportionally — half the runway, half the offsets", () => {
    const half = planMilestones({ moveInAt: daysFromNow(REQUIRED_LEAD_DAYS / 2) }, { now });
    const freeze = half.find(m => m.key === "design_freeze")!;
    // At 50% scale the 42-day offset becomes 21 days, landing on `now`.
    expect(freeze.dueAt.getTime()).toBeCloseTo(now.getTime(), -4);
  });
});

describe("planMilestones — edge cases", () => {
  it("clamps everything to now when move-in has already passed", () => {
    const plan = planMilestones({ moveInAt: daysFromNow(-5) }, { now });
    const internal = plan.filter(m => SCHEDULE_TEMPLATE.some(entry => entry.key === m.key));
    internal.forEach(m => expect(m.dueAt.getTime()).toBe(now.getTime()));
  });

  it("plans only the show window when there is no move-in date", () => {
    const plan = planMilestones({ opensAt: daysFromNow(30), closesAt: daysFromNow(33) }, { now });
    expect(keysOf(plan)).toEqual(["show_open", "show_close"]);
  });

  it("returns nothing when the show has no dates at all", () => {
    expect(planMilestones({}, { now })).toEqual([]);
  });

  it("omits fixed points that have no date rather than emitting an invalid one", () => {
    const plan = planMilestones({ moveInAt: daysFromNow(60), closesAt: daysFromNow(66) }, { now });
    expect(keysOf(plan)).toContain("show_close");
    expect(keysOf(plan)).not.toContain("show_open");
    expect(keysOf(plan)).not.toContain("move_out");
    plan.forEach(m => expect(Number.isNaN(m.dueAt.getTime())).toBe(false));
  });

  it("honours an explicit freight deadline over the template offset", () => {
    const freightDeadlineAt = daysFromNow(70);
    const plan = planMilestones({ moveInAt: daysFromNow(90), freightDeadlineAt }, { now });
    const freight = plan.find(m => m.key === "freight_cutoff")!;
    expect(freight.dueAt).toEqual(freightDeadlineAt);
    expect(freight.fixed).toBe(true);
  });

  it("keys are unique so a re-plan can update in place", () => {
    const plan = planMilestones({
      moveInAt: daysFromNow(90), opensAt: daysFromNow(93), closesAt: daysFromNow(96), moveOutAt: daysFromNow(97),
    }, { now });
    expect(new Set(keysOf(plan)).size).toBe(plan.length);
  });
});

describe("leadTimeAssessment", () => {
  it("reports runway when the standard template fits", () => {
    expect(leadTimeAssessment({ moveInAt: daysFromNow(90) }, { now })).toEqual({
      hasRunway: true, runwayDays: 90, shortfallDays: 0, feasible: true,
    });
  });

  it("reports the shortfall when the show is too close", () => {
    const assessment = leadTimeAssessment({ moveInAt: daysFromNow(20) }, { now });
    expect(assessment.hasRunway).toBe(false);
    expect(assessment.shortfallDays).toBe(REQUIRED_LEAD_DAYS - 20);
    expect(assessment.feasible).toBe(true);
  });

  it("marks a show past move-in as no longer feasible", () => {
    expect(leadTimeAssessment({ moveInAt: daysFromNow(-1) }, { now }).feasible).toBe(false);
  });

  it("treats a show with no move-in date as unconstrained", () => {
    expect(leadTimeAssessment({}, { now })).toEqual({
      hasRunway: true, runwayDays: null, shortfallDays: 0, feasible: true,
    });
  });
});
