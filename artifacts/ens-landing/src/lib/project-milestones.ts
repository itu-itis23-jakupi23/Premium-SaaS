// The client-facing milestone model for a stand build.
//
// One definition, because there were two. The dashboard's step timeline used
// thresholds 1/35/65/85/95 for created/designing/review/approved/production,
// while the "approval progress" card directly below it used 20/45/65 for
// created/designing/review. Both described the same journey from the same
// `progress` number, so at 30% the timeline called designing "active" while
// the card called created "not done" - two different answers on one screen.

export type MilestoneState = "completed" | "active" | "pending";

export interface ProjectMilestone {
  /** Suffix of `client.dashboard.step.*` and `client.dashboard.approval.*`. */
  key: "created" | "designing" | "review" | "approved" | "production";
  /** Percent of production progress at which this milestone is reached. */
  threshold: number;
}

export const PROJECT_MILESTONES: readonly ProjectMilestone[] = [
  { key: "created", threshold: 1 },
  { key: "designing", threshold: 35 },
  { key: "review", threshold: 65 },
  { key: "approved", threshold: 85 },
  { key: "production", threshold: 95 },
];

/**
 * Every milestone with its state at this progress, in journey order.
 *
 * "Active" is the first milestone not yet reached, which makes exactly one
 * active by construction - and it is the reason this is a list function rather
 * than a per-milestone one.
 *
 * The first attempt used a fixed 20-point look-ahead window instead, which
 * looked equivalent and was not: the gaps between thresholds narrow towards
 * the end of the build (85 to 95 is ten points), so at 75% both `approved`
 * and `production` fell inside their windows and the timeline pulsed two dots
 * at once - two answers to "where are we". project-milestones.test.ts walks
 * every percentage from 0 to 100 precisely because the fault only appeared in
 * part of the range.
 */
export function projectMilestones(progress: number) {
  let activeTaken = false;
  return PROJECT_MILESTONES.map((milestone) => {
    if (progress >= milestone.threshold) {
      return { key: milestone.key, threshold: milestone.threshold, state: "completed" as MilestoneState };
    }
    if (!activeTaken) {
      activeTaken = true;
      return { key: milestone.key, threshold: milestone.threshold, state: "active" as MilestoneState };
    }
    return { key: milestone.key, threshold: milestone.threshold, state: "pending" as MilestoneState };
  });
}

/**
 * True once this milestone is behind the project, used by the approval rows.
 *
 * Deliberately the same comparison `projectMilestones` uses for "completed",
 * so the card and the timeline above it cannot disagree.
 */
export function milestoneReached(
  key: ProjectMilestone["key"],
  progress: number,
): boolean {
  const milestone = PROJECT_MILESTONES.find((entry) => entry.key === key);
  // An unknown key is a programming error, not a reached milestone.
  if (!milestone) return false;
  return progress >= milestone.threshold;
}
