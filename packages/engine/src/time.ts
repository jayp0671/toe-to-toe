import { DateTime, IANAZone } from 'luxon';

/**
 * Time-zone rules from docs/PLAN.md §4 (CLAUDE.md golden rule 3).
 *
 * - A game day runs from local midnight to the next local midnight in the player's season home zone.
 *   Windows are half-open: [start, end).
 * - A day locks at 12:00 PM the next local day in the home zone.
 * - The home zone always wins: the phone's zone or offset never decides which day an instant belongs to.
 *
 * All zone math goes through Luxon. Instants come back in UTC.
 */

/** A Luxon DateTime, or an ISO 8601 string with an explicit offset or `Z`. */
export type InstantInput = DateTime<true> | DateTime<false> | string;

/** A local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string;

/** A half-open span of time [start, end). */
export interface Span {
  start: DateTime<true>;
  end: DateTime<true>;
}

/** A piece of an interval that falls inside one local day. */
export interface DayPiece extends Span {
  localDate: LocalDate;
}

const ISO_WITH_OFFSET = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalise an instant to UTC. Strings must carry an offset, otherwise their meaning would depend on
 * the machine's zone.
 */
export function toInstant(input: InstantInput): DateTime<true> {
  if (typeof input === 'string' && !ISO_WITH_OFFSET.test(input)) {
    throw new RangeError(`Instant needs an explicit offset or Z: ${input}`);
  }
  const dt: DateTime<true> | DateTime<false> =
    typeof input === 'string' ? DateTime.fromISO(input, { setZone: true }) : input;
  if (!dt.isValid) {
    throw new RangeError(
      `Invalid instant: ${String(input)} (${dt.invalidExplanation ?? dt.invalidReason})`,
    );
  }
  return dt.toUTC();
}

/** Accept only real IANA region names such as America/New_York (not abbreviations like EST). */
function assertZone(tz: string): string {
  if (!tz.includes('/') || !IANAZone.isValidZone(tz)) {
    throw new RangeError(`Not an IANA time-zone name: ${tz}`);
  }
  return tz;
}

/** Local midnight that starts `localDate` in `tz`. */
function startOfLocalDay(localDate: LocalDate, tz: string): DateTime<true> {
  assertZone(tz);
  if (!LOCAL_DATE.test(localDate)) {
    throw new RangeError(`Local date must be YYYY-MM-DD: ${localDate}`);
  }
  const dt = DateTime.fromISO(localDate, { zone: tz });
  if (!dt.isValid || dt.toISODate() !== localDate) {
    throw new RangeError(`Invalid local date: ${localDate}`);
  }
  return dt.startOf('day');
}

/** The local date of `instant` in the home zone `tz`. */
export function localDateOf(instant: InstantInput, tz: string): LocalDate {
  const local: DateTime<true> | DateTime<false> = toInstant(instant).setZone(assertZone(tz));
  if (!local.isValid) {
    throw new RangeError(`Cannot convert instant to ${tz}`);
  }
  return local.toISODate();
}

/** The game day `localDate` in `tz` as UTC instants [start, end). 23 or 25 hours on DST change days. */
export function dayWindow(localDate: LocalDate, tz: string): Span {
  const start = startOfLocalDay(localDate, tz);
  const end = start.plus({ days: 1 }).startOf('day');
  return { start: start.toUTC(), end: end.toUTC() };
}

/** When `localDate` locks: 12:00 PM the next local day in `tz`, as a UTC instant. */
export function lockInstant(localDate: LocalDate, tz: string): DateTime<true> {
  return startOfLocalDay(localDate, tz).plus({ days: 1 }).set({ hour: 12 }).toUTC();
}

/** True once `now` has reached the lock for `localDate` in `tz`. */
export function isLocked(localDate: LocalDate, tz: string, now: InstantInput): boolean {
  return toInstant(now) >= lockInstant(localDate, tz);
}

/**
 * Cut [startUtc, endUtc) at each local midnight in `tz`. Pieces are in time order and add back up to
 * the original length. An empty interval gives no pieces.
 */
export function splitIntervalByLocalDay(
  startUtc: InstantInput,
  endUtc: InstantInput,
  tz: string,
): DayPiece[] {
  const start = toInstant(startUtc);
  const end = toInstant(endUtc);
  if (end < start) {
    throw new RangeError(`Interval ends before it starts: ${start.toISO()} > ${end.toISO()}`);
  }
  const pieces: DayPiece[] = [];
  let cursor = start;
  while (cursor < end) {
    const localDate = localDateOf(cursor, tz);
    const boundary = dayWindow(localDate, tz).end;
    const pieceEnd = boundary < end ? boundary : end;
    pieces.push({ localDate, start: cursor, end: pieceEnd });
    cursor = pieceEnd;
  }
  return pieces;
}

/** Real elapsed minutes in an interval (may be fractional). Accepts a Span or a Luxon Interval. */
export function minutesOf(interval: { start: DateTime | null; end: DateTime | null }): number {
  const { start, end } = interval;
  if (!start?.isValid || !end?.isValid) {
    throw new RangeError('Invalid interval');
  }
  const ms = end.toMillis() - start.toMillis();
  if (ms < 0) {
    throw new RangeError(`Interval ends before it starts: ${start.toISO()} > ${end.toISO()}`);
  }
  return ms / 60_000;
}
