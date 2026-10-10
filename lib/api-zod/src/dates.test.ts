import { describe, expect, it } from "vitest";
import { calendarDateIn, calendarDateToInstant, isPastCalendarDate } from "./dates";

/**
 * Calendar dates held in timestamp columns.
 *
 * Due dates, quote validity and exhibition days are calendar dates stored as
 * `timestamptz`, so a day has to be represented by a moment inside it — and
 * which moment decides whether readers agree on the date. They were stored at
 * midnight, which does not survive the trip: a PM in Istanbul picking 20
 * November produced 2026-11-19T21:00Z, and clients in London, New York and Los
 * Angeles were shown 19 November on a financial document.
 */

/** Every reader's calendar date for one instant. */
function datesAround(iso: string): Record<string, string | null> {
  const zones = [
    "Pacific/Midway", // UTC-11
    "America/Los_Angeles",
    "America/New_York",
    "Europe/London",
    "Europe/Istanbul",
    "Asia/Tokyo",
  ];
  return Object.fromEntries(zones.map((zone) => [zone, calendarDateIn(iso, zone)]));
}

describe("calendarDateToInstant", () => {
  it("anchors a bare date at midday UTC", () => {
    expect(calendarDateToInstant("2026-11-20")).toBe("2026-11-20T12:00:00.000Z");
  });

  it("gives every reader from UTC-11 to UTC+9 the date that was entered", () => {
    // The failure this exists to prevent, checked across the span where most
    // of the world lives.
    const anchored = calendarDateToInstant("2026-11-20")!;
    for (const [zone, date] of Object.entries(datesAround(anchored))) {
      expect(date, zone).toBe("2026-11-20");
    }
  });

  it("improves on midnight, which was wrong for half the world", () => {
    // Midnight in the server's timezone (Europe/Istanbul, UTC+3).
    const midnightIstanbul = "2026-11-19T21:00:00.000Z";
    const wrong = Object.entries(datesAround(midnightIstanbul))
      .filter(([, date]) => date !== "2026-11-20")
      .map(([zone]) => zone);
    // Guards the guard: if this list were empty there was never a bug here.
    expect(wrong.length).toBeGreaterThan(0);
    expect(wrong).toContain("America/New_York");
    expect(wrong).toContain("Europe/London");
  });

  it("does not reach UTC+12 and beyond, and that is a known limit", () => {
    // No instant can serve every zone: inhabited offsets span 26 hours, wider
    // than a day. Midday UTC reads one day late in New Zealand's summer, Fiji,
    // Samoa and Kiribati. Asserted rather than left to be discovered, so the
    // limit is documented by a test and not only by a comment.
    const anchored = calendarDateToInstant("2026-11-20")!;
    expect(calendarDateIn(anchored, "Pacific/Auckland")).toBe("2026-11-21");
    expect(calendarDateIn(anchored, "Pacific/Kiritimati")).toBe("2026-11-21");
  });

  it("leaves a value that already carries a time alone", () => {
    // The caller meant a specific moment; moving it would be the opposite of
    // this fix.
    expect(calendarDateToInstant("2026-11-20T08:30:00.000Z")).toBe("2026-11-20T08:30:00.000Z");
  });

  it("rejects a date that does not exist", () => {
    // `new Date("2026-02-31")` rolls forward into March, which would store a
    // date nobody typed.
    expect(calendarDateToInstant("2026-02-31")).toBeNull();
    expect(calendarDateToInstant("2026-13-01")).toBeNull();
  });

  it("accepts a real leap day and rejects a false one", () => {
    expect(calendarDateToInstant("2024-02-29")).toBe("2024-02-29T12:00:00.000Z");
    expect(calendarDateToInstant("2026-02-29")).toBeNull();
  });

  it("is null for anything unusable, so a caller can refuse it", () => {
    for (const bad of ["", "   ", "not a date", null, undefined, 20261120, {}]) {
      expect(calendarDateToInstant(bad), String(bad)).toBeNull();
    }
  });
});

describe("isPastCalendarDate", () => {
  const dueAt = "2026-11-20T12:00:00.000Z";

  // The timezone is passed explicitly throughout. Left out, the function uses
  // the machine's zone and these assertions would pass or fail depending on
  // where the suite happens to run - the first version of this test asserted
  // UTC answers and failed on a UTC+3 machine, where 23:59Z really is already
  // the next day and "overdue" really is correct.
  it("is not overdue during the day it is due", () => {
    // The whole point: an invoice due on the 20th is not overdue on the 20th.
    // The instant comparison made it overdue from midday.
    expect(isPastCalendarDate(dueAt, new Date("2026-11-20T00:01:00.000Z"), "UTC")).toBe(false);
    expect(isPastCalendarDate(dueAt, new Date("2026-11-20T23:59:00.000Z"), "UTC")).toBe(false);
  });

  it("is overdue once the next day starts", () => {
    expect(isPastCalendarDate(dueAt, new Date("2026-11-21T00:01:00.000Z"), "UTC")).toBe(true);
  });

  it("is not overdue before the due date", () => {
    expect(isPastCalendarDate(dueAt, new Date("2026-11-19T23:00:00.000Z"), "UTC")).toBe(false);
  });

  it("judges by the reader's own day, not UTC's", () => {
    // 2026-11-21T02:00Z is still the 20th in New York, so an invoice due that
    // day is not yet overdue for someone reading it there.
    const nearMidnightUtc = new Date("2026-11-21T02:00:00.000Z");
    expect(isPastCalendarDate(dueAt, nearMidnightUtc, "America/New_York")).toBe(false);
    expect(isPastCalendarDate(dueAt, nearMidnightUtc, "Europe/London")).toBe(true);
  });

  it("treats a missing due date as not overdue", () => {
    // An invoice with no due date cannot be late.
    for (const empty of [null, undefined, ""]) {
      expect(isPastCalendarDate(empty, new Date("2026-12-01T00:00:00.000Z"), "UTC"), String(empty)).toBe(false);
    }
  });

  it("treats an unparseable due date as not overdue", () => {
    // Guessing "overdue" on bad data would chase a client for money.
    expect(isPastCalendarDate("not a date", new Date("2026-12-01T00:00:00.000Z"), "UTC")).toBe(false);
  });
});

describe("calendarDateIn", () => {
  it("returns an ISO calendar date", () => {
    expect(calendarDateIn("2026-11-20T12:00:00.000Z", "UTC")).toBe("2026-11-20");
  });

  it("falls back rather than blanking the date on an unknown timezone", () => {
    expect(calendarDateIn("2026-11-20T12:00:00.000Z", "Not/AZone")).toBe("2026-11-20");
  });

  it("is null for an unparseable instant", () => {
    expect(calendarDateIn("nonsense")).toBeNull();
  });
});
