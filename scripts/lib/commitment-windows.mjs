/**
 * When furniture is spoken for, and how much of it at once.
 *
 * Kept apart from the report that prints it so it can be tested: this is the
 * only part with a wrong answer available, and the report around it is I/O.
 */

/**
 * Whether a commitment is holding its items at `moment`.
 *
 * Inclusive at both ends on purpose. An item is away from the workshop for the
 * whole occupancy window including the move-out day, so a show striking on the
 * 5th still has the chairs on the 5th.
 */
export function activeAt(row, moment) {
  return row.starts_at <= moment && moment <= row.ends_at;
}

/**
 * The largest quantity of one item wanted at any single moment.
 *
 * Peak concurrency is the number that matters, not the annual total: forty
 * chairs across twelve shows in a year is ordinary, and forty on one Tuesday is
 * a problem.
 *
 * The measurement is taken at instants, never across windows, because
 * overlapping is not transitive. Given A=[Mar 1-10], B=[Mar 8-20], C=[Mar 18-30],
 * every one of them overlaps B, but A and C are never out at the same time - the
 * true peak is two, not three. Summing everything that overlaps a candidate's
 * window conflates "shares a period with" and "is simultaneous with", and
 * invents contention that does not exist.
 *
 * Testing each window's start is sufficient to find the peak: demand only ever
 * rises when a window opens, so the maximum is always attained at some start.
 * Those starts are walked in date order and ties keep the earliest, so the
 * answer is the first moment contention reaches its high-water mark and does
 * not drift with whatever order the rows arrived from SQL in.
 *
 * Returns the peak, the moment it occurs, and the commitments live at that
 * moment, so the report can name the shows involved rather than only a number.
 */
export function peakConcurrent(rows) {
  const moments = rows.map((row) => row.starts_at).sort((a, b) => a - b);
  let peak = { quantity: 0, at: null, rows: [] };
  for (const moment of moments) {
    const active = rows.filter((row) => activeAt(row, moment));
    const quantity = active.reduce((total, row) => total + row.quantity, 0);
    if (quantity > peak.quantity) peak = { quantity, at: moment, rows: active };
  }
  return peak;
}
