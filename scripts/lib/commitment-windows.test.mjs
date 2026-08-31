import { describe, expect, it } from "vitest";

import { activeAt, peakConcurrent } from "./commitment-windows.mjs";

/** A commitment of `quantity` items held from `starts` to `ends` inclusive. */
const hold = (starts, ends, quantity) => ({
  starts_at: new Date(starts),
  ends_at: new Date(ends),
  quantity,
});

const on = (day) => new Date(day);

describe("activeAt", () => {
  it("is holding items inside its window", () => {
    expect(activeAt(hold("2026-03-01", "2026-03-10", 1), on("2026-03-05"))).toBe(true);
  });

  it("is holding items on the day it opens and the day it closes", () => {
    // Move-out day still counts: the furniture is not back on the shelf until
    // it has been struck and returned.
    const window = hold("2026-03-01", "2026-03-10", 1);
    expect(activeAt(window, on("2026-03-01"))).toBe(true);
    expect(activeAt(window, on("2026-03-10"))).toBe(true);
  });

  it("is holding nothing outside its window", () => {
    const window = hold("2026-03-01", "2026-03-10", 1);
    expect(activeAt(window, on("2026-02-28"))).toBe(false);
    expect(activeAt(window, on("2026-03-11"))).toBe(false);
  });
});

describe("peakConcurrent", () => {
  it("reports nothing for no commitments", () => {
    expect(peakConcurrent([])).toEqual({ quantity: 0, at: null, rows: [] });
  });

  it("reports a lone commitment as its own peak", () => {
    const only = hold("2026-03-01", "2026-03-05", 12);
    const peak = peakConcurrent([only]);
    expect(peak.quantity).toBe(12);
    expect(peak.rows).toEqual([only]);
  });

  it("does not add up windows that never coincide", () => {
    // Forty chairs at three shows across a year is ordinary. Summing them into
    // 120 would invent a shortage that does not exist - the whole reason this
    // measures concurrency rather than volume.
    const peak = peakConcurrent([
      hold("2026-01-01", "2026-01-05", 40),
      hold("2026-06-01", "2026-06-05", 40),
      hold("2026-11-01", "2026-11-05", 40),
    ]);
    expect(peak.quantity).toBe(40);
  });

  it("adds up only the windows open at the same moment", () => {
    const peak = peakConcurrent([
      hold("2026-03-01", "2026-03-10", 10),
      hold("2026-03-05", "2026-03-15", 15), // overlaps the first
      hold("2026-09-01", "2026-09-10", 9), // far away, must not join the sum
    ]);
    expect(peak.quantity).toBe(25);
    expect(peak.rows).toHaveLength(2);
  });

  it("counts intervals that share a period but are never simultaneous only once", () => {
    // The transitivity trap. Each of these overlaps the middle window, but the
    // first is struck on the 10th and the last does not build until the 18th,
    // so all three are never out together. Reporting 3 here would send someone
    // hunting a conflict that does not exist.
    const peak = peakConcurrent([
      hold("2026-03-01", "2026-03-10", 1),
      hold("2026-03-08", "2026-03-20", 1),
      hold("2026-03-18", "2026-03-30", 1),
    ]);
    expect(peak.quantity).toBe(2);
    expect(peak.rows).toHaveLength(2);
  });

  it("finds the busiest moment rather than the earliest window", () => {
    // The first window opens earliest and the mid-March pile-up is the real
    // peak; the answer must come from demand, not from ordering.
    const peak = peakConcurrent([
      hold("2026-02-01", "2026-02-02", 9),
      hold("2026-03-01", "2026-03-20", 5),
      hold("2026-03-10", "2026-03-12", 6),
      hold("2026-03-11", "2026-03-30", 7),
    ]);
    expect(peak.quantity).toBe(18);
    expect(peak.rows).toHaveLength(3);
  });

  it("reports a moment when the peak is genuinely live", () => {
    const rows = [hold("2026-03-01", "2026-03-20", 5), hold("2026-03-11", "2026-03-30", 7)];
    const peak = peakConcurrent(rows);
    expect(peak.quantity).toBe(12);
    // Both are only out together from the 11th. Stamping the 1st would put a
    // date in the report on which just five chairs were actually needed.
    expect(peak.at).toEqual(on("2026-03-11"));
    for (const row of rows) expect(activeAt(row, peak.at)).toBe(true);
  });

  it("reports the first moment a tied peak is reached, not a later one", () => {
    // Two separate springs of equal demand. The earlier one is the one worth
    // naming: it is when the squeeze starts.
    const peak = peakConcurrent([
      hold("2026-03-01", "2026-03-05", 10),
      hold("2026-09-01", "2026-09-05", 10),
    ]);
    expect(peak.quantity).toBe(10);
    expect(peak.at).toEqual(on("2026-03-01"));
  });

  it("gives the same answer whatever order the rows arrive in", () => {
    // The rows come from SQL, whose ordering is not part of any contract. The
    // report must not change because a query plan changed.
    const rows = [
      hold("2026-03-01", "2026-03-20", 5),
      hold("2026-09-01", "2026-09-05", 12),
      hold("2026-03-11", "2026-03-30", 7),
      hold("2026-01-02", "2026-01-03", 12),
    ];
    const forwards = peakConcurrent(rows);
    const backwards = peakConcurrent([...rows].reverse());
    expect(backwards.quantity).toBe(forwards.quantity);
    expect(backwards.at).toEqual(forwards.at);
    expect(backwards.rows).toHaveLength(forwards.rows.length);
  });

  it("holds the peak across a staggered chain that does coincide", () => {
    // Four windows all open across the 15th even though no pair shares a start
    // or an end, so here the full sum is real.
    const rows = [
      hold("2026-03-01", "2026-03-20", 1),
      hold("2026-03-05", "2026-03-25", 2),
      hold("2026-03-10", "2026-03-30", 4),
      hold("2026-03-15", "2026-04-04", 8),
    ];
    const peak = peakConcurrent(rows);
    expect(peak.quantity).toBe(15);
    expect(peak.at).toEqual(on("2026-03-15"));
    for (const row of rows) expect(activeAt(row, peak.at)).toBe(true);
  });
});
