import type { ManagedProject, ManagerSummary } from "./managers-model";

/**
 * Who the chief should move work to, and which work to move.
 *
 * This decides that a named person takes on someone else's project. It lived
 * inline in a 2,611-line component alongside toast calls and dialog state,
 * which is why it had never been tested: there was nothing to call. It is a
 * pure function of the manager list now, returning a decision the component
 * renders rather than performing one itself.
 */

/** At or above this, a manager is considered overloaded and offered a rebalance. */
export const OVERLOADED_AT = 70;

/** A manager at or above this is never chosen as a destination. */
export const NEVER_LOAD_PAST = 85;

/**
 * Weights for choosing a destination. Free capacity dominates, because that is
 * what the rebalance is for; rating and a lighter project count break ties
 * between managers with similar room.
 */
export const SCORE_WEIGHTS = { capacity: 0.6, rating: 0.25, projectCount: 0.15 } as const;

/**
 * Whole days from `now` until a deadline.
 *
 * Returns null for a date that does not parse. That mattered: this fed a sort
 * comparator through `projectRisk`, and an unparseable deadline produced NaN,
 * which makes a comparator return NaN and leaves the sort order undefined -
 * so the "least critical project" could be any project at all. The display
 * helper beside the original guarded its dates; this one did not.
 */
export function daysUntil(date: string, now: Date = new Date()): number | null {
  const target = new Date(`${date}T12:00:00`);
  const time = target.getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - now.getTime()) / 86_400_000);
}

/**
 * How urgent a project is. Higher is more critical.
 *
 * Delayed adds 100, and a nearer deadline scores higher - a project overdue by
 * a week counts as more urgent than one due next month. A deadline that cannot
 * be read contributes nothing rather than poisoning the comparison; an unknown
 * date is not evidence of urgency.
 */
export function projectRisk(project: ManagedProject, now: Date = new Date()): number {
  const days = daysUntil(project.deadline, now);
  return (project.status === "Delayed" ? 100 : 0) - (days ?? 0);
}

/** Sorts most critical first. */
export function compareProjectRisk(
  a: ManagedProject,
  b: ManagedProject,
  now: Date = new Date(),
): number {
  return projectRisk(b, now) - projectRisk(a, now);
}

/** How suitable a manager is as a destination. Higher is better. */
export function destinationScore(manager: ManagerSummary, maxProjects: number): number {
  const capacity = (100 - manager.workload) * SCORE_WEIGHTS.capacity;
  const quality = (manager.rating / 5) * 100 * SCORE_WEIGHTS.rating;
  const room =
    ((maxProjects - manager.activeProjects.length) / maxProjects) * 100 * SCORE_WEIGHTS.projectCount;
  return capacity + quality + room;
}

export type RebalancePlan =
  /** The manager is not on the list, or has no active colleague to receive work. */
  | { outcome: "no-target" }
  /** Not busy enough to be worth moving anything. */
  | { outcome: "not-overloaded"; source: ManagerSummary }
  /** Everyone else is at or past the ceiling. */
  | { outcome: "all-loaded"; source: ManagerSummary }
  /** Overloaded, but holding nothing that can be handed over. */
  | { outcome: "no-project"; source: ManagerSummary; target: ManagerSummary }
  | { outcome: "move"; source: ManagerSummary; target: ManagerSummary; project: ManagedProject };

/**
 * Plans one hand-over, or explains why there is nothing to do.
 *
 * The project chosen is the *least* critical one the overloaded manager holds:
 * handing over the urgent work is how a rebalance turns into a missed deadline.
 */
export function planRebalance(
  sourceId: string,
  managers: ManagerSummary[],
  now: Date = new Date(),
): RebalancePlan {
  const source = managers.find((manager) => manager.id === sourceId);
  const candidates = managers.filter(
    (manager) => manager.id !== sourceId && manager.status === "Active",
  );

  if (!source || candidates.length === 0) return { outcome: "no-target" };
  if (source.workload < OVERLOADED_AT) return { outcome: "not-overloaded", source };

  const withRoom = candidates.filter((manager) => manager.workload < NEVER_LOAD_PAST);
  if (withRoom.length === 0) return { outcome: "all-loaded", source };

  // Normalised against every active colleague, not just those with room -
  // matching the original. Narrowing it to `withRoom` would rescale the
  // project-count term whenever the busiest manager is excluded by the
  // ceiling, quietly changing which destination wins. The `, 1` guards a
  // divide-by-zero when nobody holds a project.
  const maxProjects = Math.max(...candidates.map((m) => m.activeProjects.length), 1);
  const target = [...withRoom].sort(
    (a, b) => destinationScore(b, maxProjects) - destinationScore(a, maxProjects),
  )[0];

  const project = [...source.activeProjects].sort((a, b) => compareProjectRisk(a, b, now)).at(-1);
  if (!project) return { outcome: "no-project", source, target };

  return { outcome: "move", source, target, project };
}
