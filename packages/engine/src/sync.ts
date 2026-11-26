import type { DateTime } from 'luxon';
import {
  dedup,
  MANUAL_SOURCE,
  METRICS,
  type DedupInput,
  type HourSample,
  type HourTotals,
  type Metric,
  type Sample,
  type SourceHourTotals,
} from './dedup.ts';
import type { SyncBody } from './schemas/sync.ts';
import { SYNC_LIMITS } from './schemas/sync.ts';
import { dayWindow, localDateOf, toInstant, type LocalDate } from './time.ts';

/**
 * Pure planning for one /sync request (docs/PLAN.md §12.2, Appendix A5). The Edge Function does the
 * I/O; everything that decides what counts lives here so it can be unit tested.
 *
 * Every item is counted in at most one `ignored` bucket, checked in this order:
 *   manual          its source is the Health app (manual entry)
 *   outside_window  it ended more than 48 hours before now
 *   locked_days     it starts on a home-zone date that is locked (or under review / voided)
 * An item that starts on an open date but runs into a locked one keeps only its open part.
 */

export type DayStatus = 'live' | 'finalizing';

export interface SyncIgnored {
  locked_days: number;
  outside_window: number;
  manual: number;
}

type Item = Sample | HourSample;

export interface ScreenedSync {
  kind: SyncBody['kind'];
  homeTz: string;
  metrics: Partial<Record<Metric, Item[]>>;
  ignored: Pick<SyncIgnored, 'manual' | 'outside_window'>;
  /** Every home-zone date the kept items touch, sorted. Look up their lock status before planSync. */
  dates: LocalDate[];
}

/** An hour row tagged with the home-zone date it belongs to (by the hour's start). */
export type DatedHour = HourTotals & { localDate: LocalDate };
export type DatedSourceHour = SourceHourTotals & { localDate: LocalDate };

export interface SyncPlan {
  hours: DatedHour[];
  sourceHours: DatedSourceHour[];
  /** Open dates that received data, sorted. */
  dates: LocalDate[];
  ignored: SyncIgnored;
}

const HOUR_MS = 3_600_000;

function span(kind: SyncBody['kind'], item: Item): { start: DateTime<true>; end: DateTime<true> } {
  if (kind === 'samples') {
    const s = item as Sample;
    return { start: toInstant(s.s), end: toInstant(s.e) };
  }
  const start = toInstant((item as HourSample).h);
  return { start, end: start.plus({ milliseconds: HOUR_MS }) };
}

/** Drop manual entries and items older than the window; list the dates the rest touch. */
export function screenSync(body: SyncBody, homeTz: string, now: DateTime<true>): ScreenedSync {
  const cutoff = +toInstant(now) - SYNC_LIMITS.windowHours * HOUR_MS;
  const metrics: Partial<Record<Metric, Item[]>> = {};
  const dates = new Set<LocalDate>();
  let manual = 0;
  let outsideWindow = 0;
  for (const metric of METRICS) {
    const items: readonly Item[] | undefined = body.metrics[metric];
    if (!items) continue;
    const kept: Item[] = [];
    for (const item of items) {
      if (item.src === MANUAL_SOURCE) {
        manual++;
        continue;
      }
      const { start, end } = span(body.kind, item);
      if (+end < cutoff) {
        outsideWindow++;
        continue;
      }
      kept.push(item);
      dates.add(localDateOf(start, homeTz));
      // The last instant the item covers (a zero-length sample covers its start).
      dates.add(localDateOf(+end > +start ? end.minus({ milliseconds: 1 }) : start, homeTz));
    }
    metrics[metric] = kept;
  }
  return {
    kind: body.kind,
    homeTz,
    metrics,
    ignored: { manual, outside_window: outsideWindow },
    dates: [...dates].sort(),
  };
}

/** Drop items on locked dates, de-duplicate the rest and keep only rows on open dates. */
export function planSync(
  screened: ScreenedSync,
  isDateLocked: (date: LocalDate) => boolean,
): SyncPlan {
  const { kind, homeTz } = screened;
  const metrics: Partial<Record<Metric, Item[]>> = {};
  let lockedDays = 0;
  for (const metric of METRICS) {
    const items = screened.metrics[metric];
    if (!items) continue;
    metrics[metric] = items.filter((item) => {
      const locked = isDateLocked(localDateOf(span(kind, item).start, homeTz));
      if (locked) lockedDays++;
      return !locked;
    });
  }

  const input =
    kind === 'samples'
      ? ({
          kind,
          homeTz,
          metrics: metrics as Partial<Record<Metric, Sample[]>>,
        } satisfies DedupInput)
      : ({
          kind,
          homeTz,
          metrics: metrics as Partial<Record<Metric, HourSample[]>>,
        } satisfies DedupInput);
  const result = dedup(input);

  const dateOf = (hourStartUtc: string) => localDateOf(hourStartUtc, homeTz);
  const hours = result.hours
    .map((h) => ({ ...h, localDate: dateOf(h.hourStartUtc) }))
    .filter((h) => !isDateLocked(h.localDate));
  const sourceHours = result.sourceHours
    .map((h) => ({ ...h, localDate: dateOf(h.hourStartUtc) }))
    .filter((h) => !isDateLocked(h.localDate));

  return {
    hours,
    sourceHours,
    dates: [...new Set(hours.map((h) => h.localDate))].sort(),
    ignored: {
      locked_days: lockedDays,
      outside_window: screened.ignored.outside_window,
      manual: screened.ignored.manual,
    },
  };
}

/** Stored hours overlaid with this sync's hours: a re-sent hour replaces the stored one. */
export function mergeHours(
  stored: readonly HourTotals[],
  incoming: readonly HourTotals[],
): HourTotals[] {
  const byHour = new Map<number, HourTotals>();
  for (const row of [...stored, ...incoming]) {
    byHour.set(+toInstant(row.hourStartUtc), {
      hourStartUtc: toInstant(row.hourStartUtc).toISO({ suppressMilliseconds: true }),
      steps: row.steps,
      flights: row.flights,
      distance_m: row.distance_m,
    });
  }
  return [...byHour].sort(([a], [b]) => a - b).map(([, row]) => row);
}

/** Distinct source names per home-zone date (by hour start), sorted. */
export function sourcesByDate(
  rows: readonly { hourStartUtc: string; sourceName: string }[],
  homeTz: string,
): Map<LocalDate, string[]> {
  const sets = new Map<LocalDate, Set<string>>();
  for (const row of rows) {
    const date = localDateOf(row.hourStartUtc, homeTz);
    const set = sets.get(date) ?? new Set<string>();
    set.add(row.sourceName);
    sets.set(date, set);
  }
  return new Map([...sets].map(([date, set]) => [date, [...set].sort()]));
}

/** Live during the local day, Finalizing from local midnight until the lock (PLAN §5.2, A7). */
export function dayStatus(localDate: LocalDate, homeTz: string, now: DateTime<true>): DayStatus {
  return +toInstant(now) < +dayWindow(localDate, homeTz).end ? 'live' : 'finalizing';
}

/**
 * Score preview stub for /sync until P2.1 brings the real scoring: 1 step = 1 hundredth (0.01).
 */
export function stubPointsHundredths(steps: number): number {
  return steps;
}
