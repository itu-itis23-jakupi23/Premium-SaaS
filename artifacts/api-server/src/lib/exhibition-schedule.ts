/**
 * Backwards planning for an exhibition (SHOW-01).
 *
 * Everything in stand building is scheduled backwards from the day the crew
 * gets into the hall. This module turns a show's dates into the internal
 * milestone chain that has to happen before them. It is pure: no database, no
 * clock of its own — the caller passes `now` — so the planning rules can be
 * tested exactly.
 */

export interface ExhibitionDates {
  /** Day the crew may start building. The anchor for every internal deadline. */
  moveInAt?: Date | null;
  opensAt?: Date | null;
  closesAt?: Date | null;
  moveOutAt?: Date | null;
  /** Explicit freight cut-off; derived from the template when absent. */
  freightDeadlineAt?: Date | null;
}

export interface PlannedMilestone {
  /** Stable identifier so a re-plan updates rather than duplicates. */
  key: string;
  title: string;
  dueAt: Date;
  sortOrder: number;
  /** True when the date came from the show itself rather than the template. */
  fixed: boolean;
  /** Set when the chain had to be compressed to fit the runway available. */
  compressed?: boolean;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Internal chain, in days before move-in. Ordered furthest-out first; the
 * numbers mirror PRODUCTION_TASK_TEMPLATE in routes/workspace.ts, extended
 * backwards to cover design and sign-off.
 */
export const SCHEDULE_TEMPLATE = [
  { key: 'design_freeze',     title: 'Design freeze',                 daysBeforeMoveIn: 42 },
  { key: 'client_sign_off',   title: 'Client sign-off on final design', daysBeforeMoveIn: 35 },
  { key: 'materials_ordered', title: 'Order stand system materials',  daysBeforeMoveIn: 28 },
  { key: 'graphics_print',    title: 'Print fascia and graphic panels', daysBeforeMoveIn: 21 },
  { key: 'fabrication_done',  title: 'Fabrication complete and QA passed', daysBeforeMoveIn: 14 },
  { key: 'freight_cutoff',    title: 'Freight leaves the workshop',   daysBeforeMoveIn: 10 },
  { key: 'crew_scheduled',    title: 'Build crew confirmed',          daysBeforeMoveIn: 7 },
] as const;

/** Longest lead time the template needs, in days. */
export const REQUIRED_LEAD_DAYS = SCHEDULE_TEMPLATE[0].daysBeforeMoveIn;

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * DAY_MS);
}

/**
 * Plan the milestone chain for one show.
 *
 * When there is enough runway between `now` and move-in, each template entry
 * lands on its exact offset. When the show is closer than the template needs,
 * the chain is compressed proportionally into the time that is left rather
 * than emitting dates in the past — a stand booked three weeks out still needs
 * every step, just sooner. Order is always preserved.
 *
 * Passing no move-in date yields only the fixed show-window milestones, since
 * there is nothing to plan backwards from.
 */
export function planMilestones(dates: ExhibitionDates, options: { now?: Date } = {}): PlannedMilestone[] {
  const now = options.now ?? new Date();
  const planned: PlannedMilestone[] = [];

  const moveInAt = dates.moveInAt ?? null;
  if (moveInAt) {
    const runwayDays = (moveInAt.getTime() - now.getTime()) / DAY_MS;
    // Compress only when the runway is short *and* still ahead of us; a show
    // already in progress falls through to the clamp below.
    const compressed = runwayDays < REQUIRED_LEAD_DAYS;
    const scale = compressed && runwayDays > 0 ? runwayDays / REQUIRED_LEAD_DAYS : 1;

    SCHEDULE_TEMPLATE.forEach((entry, index) => {
      const offset = entry.daysBeforeMoveIn * scale;
      let dueAt = addDays(moveInAt, -offset);
      // Never plan into the past: a missed step is due immediately, not last week.
      if (dueAt.getTime() < now.getTime()) dueAt = new Date(now.getTime());
      // The freight cut-off is a hard external date when the show declares one.
      if (entry.key === 'freight_cutoff' && dates.freightDeadlineAt) dueAt = dates.freightDeadlineAt;

      planned.push({
        key: entry.key,
        title: entry.title,
        dueAt,
        sortOrder: index,
        fixed: entry.key === 'freight_cutoff' && Boolean(dates.freightDeadlineAt),
        ...(compressed ? { compressed: true } : {}),
      });
    });
  }

  const fixedPoints: { key: string; title: string; at?: Date | null }[] = [
    { key: 'move_in',  title: 'Move-in and build starts', at: moveInAt },
    { key: 'show_open', title: 'Show opens',              at: dates.opensAt },
    { key: 'show_close', title: 'Show closes',            at: dates.closesAt },
    { key: 'move_out', title: 'Dismantle and move-out',   at: dates.moveOutAt },
  ];

  fixedPoints.forEach(point => {
    if (!point.at) return;
    planned.push({
      key: point.key,
      title: point.title,
      dueAt: point.at,
      sortOrder: planned.length,
      fixed: true,
    });
  });

  // Renumber so sortOrder is dense and matches chronological intent even when
  // optional dates were skipped.
  return planned.map((milestone, index) => ({ ...milestone, sortOrder: index }));
}

/**
 * Whether a show can still be delivered on the standard template, and by how
 * much it is short. Drives the "tight timeline" warning in the UI.
 */
export function leadTimeAssessment(dates: ExhibitionDates, options: { now?: Date } = {}) {
  const now = options.now ?? new Date();
  if (!dates.moveInAt) return { hasRunway: true, runwayDays: null, shortfallDays: 0, feasible: true };

  const runwayDays = Math.floor((dates.moveInAt.getTime() - now.getTime()) / DAY_MS);
  const shortfallDays = Math.max(0, REQUIRED_LEAD_DAYS - runwayDays);
  return {
    hasRunway: shortfallDays === 0,
    runwayDays,
    shortfallDays,
    // A show already past move-in cannot be planned at all.
    feasible: runwayDays > 0,
  };
}
