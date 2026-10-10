/**
 * Calendar dates stored in timestamp columns.
 *
 * An invoice due date, a quote validity date and an exhibition's opening day
 * are calendar dates: "due 20 November" means the whole of that day, not an
 * instant. The schema stores them as `timestamptz`, so a day has to be
 * represented as some moment within it — and which moment decides whether
 * every reader agrees on the date.
 *
 * They were stored at midnight, which does not survive the trip:
 *
 *   a PM in Istanbul picks 20 November
 *   -> '2026-11-20'::timestamptz is 2026-11-20 00:00+03 = 2026-11-19 21:00Z
 *   -> a client in London, New York or Los Angeles is shown 19 November
 *
 * The due date on a financial document was a day early for every reader west
 * of the agency, and `isOverdue` flagged the invoice a full day before its
 * deadline. Exhibition dates had the same fault by a different route:
 * `new Date("2026-11-20")` is UTC midnight, which shifts for every negative
 * offset.
 *
 * Midday UTC is the best available answer, and it is worth being precise about
 * what "best" means here: no instant can satisfy every timezone. Inhabited
 * offsets span UTC-12 to UTC+14, which is 26 hours - wider than a day - so any
 * single moment falls on two different calendar dates somewhere. Midnight fails
 * for roughly half the world; midday UTC holds from UTC-12 to UTC+11, which is
 * everywhere except UTC+12 to UTC+14 (New Zealand in its summer, Fiji, Samoa,
 * Kiribati), where it reads one day late.
 *
 * Closing that last gap needs the column to stop pretending a date is an
 * instant - either `date` instead of `timestamptz`, or rendering these fields
 * in the agency's own timezone rather than the reader's. Both are larger
 * changes than this; this one removes the fault for almost every reader and
 * leaves a smaller, documented one behind rather than a silent one.
 */

/** Matches a bare calendar date, which is what `<input type="date">` submits. */
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A calendar date as the instant most timezones agree the date of.
 *
 * A value that already carries a time is returned untouched: the caller meant
 * a specific moment, and moving it would be the opposite of this fix. Anything
 * unparseable returns null so the caller can reject rather than store a guess.
 */
export function calendarDateToInstant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;

  const match = CALENDAR_DATE.exec(text);
  if (!match) {
    // Already an instant, or something else entirely. Only accept it if it
    // really parses - `::timestamptz` would otherwise raise at the database.
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const [, year, month, day] = match;
  const instant = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
  if (Number.isNaN(instant.getTime())) return null;
  // Reject 2026-02-31 and friends, which Date rolls forward into March.
  if (instant.toISOString().slice(0, 10) !== text) return null;
  return instant.toISOString();
}

/**
 * The calendar date of an instant, in a given timezone, as `YYYY-MM-DD`.
 *
 * Built from `en-CA`, whose short date format is already ISO, so no manual
 * component assembly and no off-by-one from `getDate()` in the wrong zone.
 */
export function calendarDateIn(value: string | Date, timeZone?: string): string | null {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    // An unknown timezone name should not blank the date.
    return instant.toISOString().slice(0, 10);
  }
}

/**
 * Whether a due date has passed, compared as dates rather than instants.
 *
 * An invoice due on the 20th is not overdue *during* the 20th. Comparing the
 * stored instant against `now` made it overdue from midday, and before this
 * fix from the previous evening. Comparing calendar dates in the reader's own
 * timezone is what someone looking at the screen means by "overdue".
 */
export function isPastCalendarDate(
  value: string | null | undefined,
  now: Date = new Date(),
  timeZone?: string,
): boolean {
  if (!value) return false;
  const due = calendarDateIn(value, timeZone);
  const today = calendarDateIn(now, timeZone);
  if (!due || !today) return false;
  return due < today;
}
