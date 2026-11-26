import { DateTime } from 'luxon';
import { localDateOf, splitIntervalByLocalDay, toInstant, type LocalDate } from './time.ts';

/**
 * De-duplication of Health samples (docs/PLAN.md §12.2, Appendix A3 layer 4, A5).
 *
 * 1. Samples from the Health app itself (`src === "Health"`) are manual entries: dropped and counted.
 * 2. Each sample's count is spread evenly over the UTC minutes it touches. Integer math only: the
 *    leftover units go to the earliest minutes, so a sample's minutes always add back to its count.
 *    `distance_m` may be fractional on the wire. Each sample is rounded half up to whole metres
 *    before spreading (Jay, 2026-11-26, PLAN §19).
 * 3. In each minute the source with the largest count wins (ties: smallest source name in code-point
 *    order). Each metric is decided on its own.
 * 4. Output is per-source and de-duplicated totals per UTC hour, plus home-zone days summed from the
 *    de-duplicated hours (`dailyTotals`).
 *
 * Fallback kind "hours" (A5, A10 v1.1): items are per-source hourly totals. Each is spread over its 60
 * minutes, and in each UTC hour the largest source's total is kept.
 *
 * Pure and deterministic: the output does not depend on input order or on the clock.
 */

export const METRICS = ['steps', 'flights', 'distance_m'] as const;
export type Metric = (typeof METRICS)[number];

/** Source name of manual entries typed into the Health app. */
export const MANUAL_SOURCE = 'Health';

/** One Health sample (A5 kind "samples"). Instants are ISO 8601 with an offset. */
export interface Sample {
  s: string;
  e: string;
  n: number;
  src: string;
}

/** One per-source hourly total (A5 kind "hours"). `h` is the start of the hour. */
export interface HourSample {
  h: string;
  n: number;
  src: string;
}

export type DedupInput =
  | { kind: 'samples'; homeTz: string; metrics: Partial<Record<Metric, readonly Sample[]>> }
  | { kind: 'hours'; homeTz: string; metrics: Partial<Record<Metric, readonly HourSample[]>> };

export interface Totals {
  steps: number;
  flights: number;
  distance_m: number;
}

/** A row of `hours`: de-duplicated totals for one UTC hour. */
export interface HourTotals extends Totals {
  hourStartUtc: string;
}

/** A row of `source_hours`: one source's totals for one UTC hour, before de-duplication. */
export interface SourceHourTotals extends HourTotals {
  sourceName: string;
}

/** Home-zone daily totals, summed from de-duplicated hours. */
export interface DayTotals extends Totals {
  localDate: LocalDate;
}

export interface DedupResult {
  /** Sorted by hour, then source name. */
  sourceHours: SourceHourTotals[];
  /** Sorted by hour. */
  hours: HourTotals[];
  /** Sorted by date. */
  days: DayTotals[];
  ignored: { manual: number };
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

/**
 * Turn a wire count into an integer count. Steps and flights must already be whole numbers.
 * Distance is rounded half up to whole metres.
 */
export function toCount(metric: Metric, n: number): number {
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError(`${metric} count must be a finite number >= 0: ${String(n)}`);
  }
  if (metric === 'distance_m') {
    // Math.round rounds .5 up for non-negative numbers.
    return Math.round(n);
  }
  if (!Number.isInteger(n)) {
    throw new RangeError(`${metric} count must be a whole number: ${String(n)}`);
  }
  return n;
}

/**
 * The part of `n` that minutes [from, to) receive when `n` is spread evenly over `len` minutes,
 * with leftover units given one each to the earliest minutes.
 */
export function spreadShare(n: number, len: number, from: number, to: number): number {
  const q = Math.floor(n / len);
  const r = n % len;
  return (to - from) * q + Math.max(0, Math.min(r, to) - Math.min(r, from));
}

/** The source with the largest count; ties go to the smallest name (code-point order). */
export function pickWinner(
  counts: ReadonlyMap<string, number>,
): { src: string; n: number } | undefined {
  let best: { src: string; n: number } | undefined;
  for (const [src, n] of counts) {
    if (!best || n > best.n || (n === best.n && src < best.src)) {
      best = { src, n };
    }
  }
  return best;
}

function minuteOf(iso: string): number {
  return Math.floor(toInstant(iso).toMillis() / MS_PER_MINUTE);
}

function hourIso(hour: number): string {
  return DateTime.fromMillis(hour * MINUTES_PER_HOUR * MS_PER_MINUTE, { zone: 'utc' }).toISO({
    suppressMilliseconds: true,
  }) as string;
}

/** minute -> source -> count */
type MinuteGrid = Map<number, Map<string, number>>;

function addToGrid(grid: MinuteGrid, minute: number, src: string, n: number): void {
  if (n === 0) return;
  let bySource = grid.get(minute);
  if (!bySource) {
    bySource = new Map();
    grid.set(minute, bySource);
  }
  bySource.set(src, (bySource.get(src) ?? 0) + n);
}

/** Spread `n` evenly over minutes [first, first + len). */
function spreadInto(grid: MinuteGrid, first: number, len: number, src: string, n: number): void {
  for (let i = 0; i < len; i++) {
    addToGrid(grid, first + i, src, spreadShare(n, len, i, i + 1));
  }
}

function addTo<K>(map: Map<K, number>, key: K, n: number): void {
  map.set(key, (map.get(key) ?? 0) + n);
}

interface MetricHours {
  /** source -> hour -> count */
  bySource: Map<string, Map<number, number>>;
  /** hour -> de-duplicated count */
  dedup: Map<number, number>;
}

function sourceHoursOf(grid: MinuteGrid): Map<string, Map<number, number>> {
  const bySource = new Map<string, Map<number, number>>();
  for (const [minute, counts] of grid) {
    const hour = Math.floor(minute / MINUTES_PER_HOUR);
    for (const [src, n] of counts) {
      let hours = bySource.get(src);
      if (!hours) {
        hours = new Map();
        bySource.set(src, hours);
      }
      addTo(hours, hour, n);
    }
  }
  return bySource;
}

/** Kind "samples": the winner is chosen per minute. */
function fromSamples(samples: readonly Sample[], metric: Metric): MetricHours {
  const grid: MinuteGrid = new Map();
  for (const sample of samples) {
    const n = toCount(metric, sample.n);
    const start = toInstant(sample.s).toMillis();
    const end = toInstant(sample.e).toMillis();
    if (end < start) {
      throw new RangeError(`Sample ends before it starts: ${sample.s} > ${sample.e}`);
    }
    const first = Math.floor(start / MS_PER_MINUTE);
    // Every minute the sample touches; a zero-length sample still sits in its minute.
    const len = Math.max(1, Math.ceil(end / MS_PER_MINUTE) - first);
    spreadInto(grid, first, len, sample.src, n);
  }
  const dedup = new Map<number, number>();
  for (const [minute, counts] of grid) {
    const winner = pickWinner(counts);
    if (winner) addTo(dedup, Math.floor(minute / MINUTES_PER_HOUR), winner.n);
  }
  return { bySource: sourceHoursOf(grid), dedup };
}

/** Kind "hours": each item covers 60 minutes from `h`; the winner is chosen per UTC hour. */
function fromHours(items: readonly HourSample[], metric: Metric): MetricHours {
  const grid: MinuteGrid = new Map();
  for (const item of items) {
    spreadInto(grid, minuteOf(item.h), MINUTES_PER_HOUR, item.src, toCount(metric, item.n));
  }
  const bySource = sourceHoursOf(grid);
  const perHour = new Map<number, Map<string, number>>();
  for (const [src, hours] of bySource) {
    for (const [hour, n] of hours) {
      let counts = perHour.get(hour);
      if (!counts) {
        counts = new Map();
        perHour.set(hour, counts);
      }
      counts.set(src, n);
    }
  }
  const dedup = new Map<number, number>();
  for (const [hour, counts] of perHour) {
    const winner = pickWinner(counts);
    if (winner) dedup.set(hour, winner.n);
  }
  return { bySource, dedup };
}

const emptyTotals = (): Totals => ({ steps: 0, flights: 0, distance_m: 0 });

/** De-duplicate one sync payload. */
export function dedup(input: DedupInput): DedupResult {
  // Validate the zone up front, even when there is no data.
  localDateOf('1970-01-01T00:00:00Z', input.homeTz);

  let manual = 0;
  const sourceRows = new Map<string, Map<number, Totals>>();
  const hourRows = new Map<number, Totals>();

  for (const metric of METRICS) {
    const all: readonly (Sample | HourSample)[] = input.metrics[metric] ?? [];
    const kept = all.filter((item) => item.src !== MANUAL_SOURCE);
    manual += all.length - kept.length;
    const result =
      input.kind === 'samples'
        ? fromSamples(kept as Sample[], metric)
        : fromHours(kept as HourSample[], metric);

    for (const [src, hours] of result.bySource) {
      let rows = sourceRows.get(src);
      if (!rows) {
        rows = new Map();
        sourceRows.set(src, rows);
      }
      for (const [hour, n] of hours) {
        const row = rows.get(hour) ?? emptyTotals();
        row[metric] += n;
        rows.set(hour, row);
      }
    }
    for (const [hour, n] of result.dedup) {
      const row = hourRows.get(hour) ?? emptyTotals();
      row[metric] += n;
      hourRows.set(hour, row);
    }
  }

  const sourceHours: SourceHourTotals[] = [...sourceRows]
    .flatMap(([src, rows]) => [...rows].map(([hour, totals]) => ({ hour, src, totals })))
    .sort((a, b) => a.hour - b.hour || (a.src < b.src ? -1 : a.src > b.src ? 1 : 0))
    .map(({ hour, src, totals }) => ({ hourStartUtc: hourIso(hour), sourceName: src, ...totals }));

  const hours: HourTotals[] = [...hourRows]
    .sort(([a], [b]) => a - b)
    .map(([hour, totals]) => ({ hourStartUtc: hourIso(hour), ...totals }));

  return {
    sourceHours,
    hours,
    days: dailyTotals(hours, input.homeTz),
    ignored: { manual },
  };
}

/**
 * Sum de-duplicated UTC hours into home-zone days. An hour that straddles a local midnight (half-hour
 * zones such as Asia/Kolkata) is split by minute with the same even-spread rule, so day totals always
 * add back up to the hour totals.
 */
export function dailyTotals(hours: readonly HourTotals[], homeTz: string): DayTotals[] {
  const days = new Map<LocalDate, Totals>();
  for (const row of hours) {
    const start = toInstant(row.hourStartUtc);
    if (start.minute !== 0 || start.second !== 0 || start.millisecond !== 0) {
      throw new RangeError(`Hour must start on a UTC hour: ${row.hourStartUtc}`);
    }
    for (const piece of splitIntervalByLocalDay(start, start.plus({ hours: 1 }), homeTz)) {
      const from = Math.round((piece.start.toMillis() - start.toMillis()) / MS_PER_MINUTE);
      const to = Math.round((piece.end.toMillis() - start.toMillis()) / MS_PER_MINUTE);
      const day = days.get(piece.localDate) ?? emptyTotals();
      for (const metric of METRICS) {
        day[metric] += spreadShare(row[metric], MINUTES_PER_HOUR, from, to);
      }
      days.set(piece.localDate, day);
    }
  }
  return [...days]
    .filter(([, t]) => t.steps + t.flights + t.distance_m > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([localDate, totals]) => ({ localDate, ...totals }));
}
