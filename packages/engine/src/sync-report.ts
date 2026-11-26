import { DateTime } from 'luxon';
import {
  dayWindow,
  localDateOf,
  lockInstant,
  toInstant,
  type InstantInput,
  type LocalDate,
} from './time.ts';

/**
 * Pure calculations behind `pnpm sync-report` (docs/PROMPTS.md P0.8, docs/PLAN.md §16 Phase 0 "Done
 * when"): 95% of player-days synced by noon, and totals within 2% of the Health app on 90% of days,
 * for Watch and phone-only players alike. The script (scripts/sync-report.ts) does the I/O.
 *
 * Rules used (also in docs/PLAN.md §19):
 * - A player-day is "synced by lock" when an accepted sync (public.sync_log) arrived at or after the
 *   end of that home-zone day and before its noon lock. Only such a sync can carry the whole day,
 *   because the Shortcut sends yesterday 12:00 AM to now (§12.2).
 * - % error = |counted - Health| / Health. Within 2% is decided with integers (inclusive).
 * - A day with no Health number entered is "no Health number": it counts for the sync line, and is
 *   left out of the error line (it can't be measured). A group with no measured days fails the line.
 * - Both lines must pass in each group separately. A group with no testers fails both lines.
 */

export type TesterGroup = 'watch' | 'phone';

export const GROUP_LABELS: Record<TesterGroup, string> = {
  watch: 'Watch wearers',
  phone: 'Phone only',
};

export const SYNC_TARGET_PERCENT = 95;
export const ERROR_TOLERANCE_PERCENT = 2;
export const ERROR_TARGET_PERCENT = 90;

/**
 * Tester group from users.dev_note: "Watch wearer" or "Phone only" (seed.sql, docs/STAGING.md §6).
 * Anyone else (no note, the smoke user) is not a Phase 0 tester.
 */
export function testerGroup(devNote: string | null): TesterGroup | null {
  const note = (devNote ?? '').trim().toLowerCase().replace(/[-_]/g, ' ');
  if (note === 'watch wearer') return 'watch';
  if (note === 'phone only') return 'phone';
  return null;
}

/** The last `days` home-zone dates that have already locked at `now`, oldest first. */
export function reportDates(now: InstantInput, tz: string, days: number): LocalDate[] {
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError(`days must be a positive integer: ${days}`);
  }
  const at = toInstant(now);
  // Yesterday has locked after local noon today; before that the newest locked date is two days ago.
  let newest = DateTime.fromISO(localDateOf(at, tz), { zone: 'UTC' }).minus({ days: 1 });
  if (at < lockInstant(newest.toISODate() ?? '', tz)) newest = newest.minus({ days: 1 });
  const dates: LocalDate[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dates.push(newest.minus({ days: i }).toISODate() ?? '');
  }
  return dates;
}

/** The earliest sync at or after the end of `localDate` (any time, even after the lock). */
function firstSyncAfter(
  localDate: LocalDate,
  tz: string,
  syncTimes: InstantInput[],
): DateTime<true> | null {
  const end = dayWindow(localDate, tz).end;
  let first: DateTime<true> | null = null;
  for (const t of syncTimes) {
    const at = toInstant(t);
    if (at >= end && (first === null || at < first)) first = at;
  }
  return first;
}

/** True when some sync arrived in [end of `localDate`, its noon lock). */
export function syncedByLock(localDate: LocalDate, tz: string, syncTimes: InstantInput[]): boolean {
  const first = firstSyncAfter(localDate, tz, syncTimes);
  return first !== null && first < lockInstant(localDate, tz);
}

/** |counted - health| / health as a percentage. 0 vs 0 is 0; anything vs 0 is Infinity. */
export function percentError(counted: number, health: number): number {
  if (health === 0) return counted === 0 ? 0 : Number.POSITIVE_INFINITY;
  return (Math.abs(counted - health) * 100) / health;
}

/** Within `tolerance`% (inclusive), decided with integer maths. */
export function withinTolerance(
  counted: number,
  health: number,
  tolerance = ERROR_TOLERANCE_PERCENT,
): boolean {
  return Math.abs(counted - health) * 100 <= tolerance * health;
}

/** One decimal for the table, rounded half up with integer maths. */
export function formatPercentError(counted: number, health: number): string {
  if (health === 0) return counted === 0 ? '0.0%' : 'n/a (Health 0)';
  const tenths = Math.floor((Math.abs(counted - health) * 2000 + health) / (2 * health));
  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
}

export interface DayInput {
  userId: string;
  name: string;
  group: TesterGroup;
  localDate: LocalDate;
  tz: string;
  /** daily_stats.steps, or null when there is no row for the day. */
  countedSteps: number | null;
  /** phase0_checks.health_steps, or null when the tester didn't enter one. */
  healthSteps: number | null;
  sources: string[];
  /** Every accepted sync time for this tester (sync_log.synced_at). */
  syncTimes: InstantInput[];
}

export type DayError =
  { kind: 'no-health' } | { kind: 'measured'; percent: number; within: boolean };

export interface EvaluatedDay extends Omit<DayInput, 'syncTimes'> {
  syncedByLock: boolean;
  /** ISO instant of the first sync after the day ended, or null if none yet. */
  firstSyncAfterDayEnd: string | null;
  error: DayError;
}

export function evaluateDay(input: DayInput): EvaluatedDay {
  const { syncTimes, ...rest } = input;
  const first = firstSyncAfter(input.localDate, input.tz, syncTimes);
  const counted = input.countedSteps ?? 0;
  const error: DayError =
    input.healthSteps === null
      ? { kind: 'no-health' }
      : {
          kind: 'measured',
          percent: percentError(counted, input.healthSteps),
          within: withinTolerance(counted, input.healthSteps),
        };
  return {
    ...rest,
    syncedByLock: first !== null && first < lockInstant(input.localDate, input.tz),
    firstSyncAfterDayEnd: first?.toISO() ?? null,
    error,
  };
}

export interface GroupSummary {
  group: TesterGroup;
  testers: number;
  playerDays: number;
  synced: number;
  /** Days with a Health number. */
  measured: number;
  within: number;
  noHealth: number;
}

export interface Verdict {
  pass: boolean;
  /** Why it failed, one line per failing group. Empty on PASS. */
  reasons: string[];
}

export interface Summary {
  groups: Record<TesterGroup, GroupSummary>;
  syncLine: Verdict;
  errorLine: Verdict;
}

const pct = (n: number, d: number) => `${((n * 100) / d).toFixed(1)}%`;

export function summarize(days: EvaluatedDay[]): Summary {
  const groups = {} as Record<TesterGroup, GroupSummary>;
  for (const group of ['watch', 'phone'] as const) {
    const mine = days.filter((d) => d.group === group);
    const measured = mine.filter((d) => d.error.kind === 'measured');
    groups[group] = {
      group,
      testers: new Set(mine.map((d) => d.userId)).size,
      playerDays: mine.length,
      synced: mine.filter((d) => d.syncedByLock).length,
      measured: measured.length,
      within: measured.filter((d) => d.error.kind === 'measured' && d.error.within).length,
      noHealth: mine.length - measured.length,
    };
  }

  const syncReasons: string[] = [];
  const errorReasons: string[] = [];
  for (const g of Object.values(groups)) {
    const label = GROUP_LABELS[g.group];
    if (g.testers === 0) {
      syncReasons.push(`${label}: no testers`);
      errorReasons.push(`${label}: no testers`);
      continue;
    }
    if (g.synced * 100 < SYNC_TARGET_PERCENT * g.playerDays) {
      syncReasons.push(
        `${label}: ${g.synced}/${g.playerDays} synced by lock (${pct(g.synced, g.playerDays)}), needs ${SYNC_TARGET_PERCENT}%`,
      );
    }
    if (g.measured === 0) {
      errorReasons.push(`${label}: no days with a Health number`);
    } else if (g.within * 100 < ERROR_TARGET_PERCENT * g.measured) {
      errorReasons.push(
        `${label}: ${g.within}/${g.measured} days within ${ERROR_TOLERANCE_PERCENT}% (${pct(g.within, g.measured)}), needs ${ERROR_TARGET_PERCENT}%`,
      );
    }
  }
  return {
    groups,
    syncLine: { pass: syncReasons.length === 0, reasons: syncReasons },
    errorLine: { pass: errorReasons.length === 0, reasons: errorReasons },
  };
}
