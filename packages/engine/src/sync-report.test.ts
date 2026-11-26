import { describe, expect, it } from 'vitest';
import {
  evaluateDay,
  formatPercentError,
  percentError,
  reportDates,
  summarize,
  syncedByLock,
  testerGroup,
  withinTolerance,
  type EvaluatedDay,
} from './sync-report.ts';

const NY = 'America/New_York';
const HFX = 'America/Halifax';
const VAN = 'America/Vancouver';

describe('testerGroup (users.dev_note, docs/STAGING.md §6)', () => {
  it('maps the two seed / STAGING notes, ignoring case and spaces', () => {
    expect(testerGroup('Watch wearer')).toBe('watch');
    expect(testerGroup('  watch WEARER ')).toBe('watch');
    expect(testerGroup('Phone only')).toBe('phone');
    expect(testerGroup('phone-only')).toBe('phone');
  });
  it('leaves everyone else out of the report', () => {
    expect(testerGroup(null)).toBeNull();
    expect(testerGroup('')).toBeNull();
    expect(testerGroup('Smoke test user (hidden crew)')).toBeNull();
  });
});

describe('reportDates', () => {
  it('ends with the newest date that has already locked in the home zone', () => {
    // 9:00 AM ET Jan 11: Jan 10 is not locked yet (noon), so the window ends Jan 9.
    expect(reportDates('2027-01-11T14:00:00Z', NY, 3)).toEqual([
      '2027-01-07',
      '2027-01-08',
      '2027-01-09',
    ]);
    // 12:00 PM ET exactly: Jan 10 has locked.
    expect(reportDates('2027-01-11T17:00:00Z', NY, 2)).toEqual(['2027-01-09', '2027-01-10']);
  });
  it('uses each zone on its own: at 1 PM ET, Halifax has locked Jan 10 but Vancouver has not', () => {
    const now = '2027-01-11T18:00:00Z';
    expect(reportDates(now, HFX, 1)).toEqual(['2027-01-10']);
    expect(reportDates(now, NY, 1)).toEqual(['2027-01-10']);
    expect(reportDates(now, VAN, 1)).toEqual(['2027-01-09']);
  });
  it('rejects a non-positive day count', () => {
    expect(() => reportDates('2027-01-11T14:00:00Z', NY, 0)).toThrow(RangeError);
  });
});

describe('syncedByLock: a sync at or after the day ended and before its noon lock', () => {
  it('counts a morning sync and the last instant before noon', () => {
    expect(syncedByLock('2027-01-10', NY, ['2027-01-11T13:00:00Z'])).toBe(true); // 8 AM
    expect(syncedByLock('2027-01-10', NY, ['2027-01-11T05:00:00Z'])).toBe(true); // midnight
    expect(syncedByLock('2027-01-10', NY, ['2027-01-11T16:59:59Z'])).toBe(true); // 11:59:59 AM
  });
  it('does not count syncs during the day itself or at/after the lock', () => {
    expect(syncedByLock('2027-01-10', NY, ['2027-01-11T04:59:59Z'])).toBe(false); // 11:59:59 PM Jan 10
    expect(syncedByLock('2027-01-10', NY, ['2027-01-11T17:00:00Z'])).toBe(false); // noon
    expect(syncedByLock('2027-01-10', NY, [])).toBe(false);
  });
  it('uses the home zone, not UTC: Vancouver is UTC-7 all year (tzdata 2026), 8 AM is 15:00Z', () => {
    expect(syncedByLock('2027-01-10', VAN, ['2027-01-11T15:00:00Z'])).toBe(true);
    expect(syncedByLock('2027-01-10', VAN, ['2027-01-11T06:30:00Z'])).toBe(false); // 11:30 PM Jan 10
    expect(syncedByLock('2027-01-10', VAN, ['2027-01-11T19:00:00Z'])).toBe(false); // noon
  });
  it('handles a 23-hour DST day (Mar 14 2027 in New York)', () => {
    // Mar 14 ends at 04:00Z Mar 15 (EDT), lock at 16:00Z.
    expect(syncedByLock('2027-03-14', NY, ['2027-03-15T04:00:00Z'])).toBe(true);
    expect(syncedByLock('2027-03-14', NY, ['2027-03-15T15:59:00Z'])).toBe(true);
    expect(syncedByLock('2027-03-14', NY, ['2027-03-15T16:00:00Z'])).toBe(false);
  });
});

describe('percentError and withinTolerance (integer steps, no float compare)', () => {
  it('is |counted - health| / health', () => {
    expect(percentError(10200, 10000)).toBe(2);
    expect(percentError(9800, 10000)).toBe(2);
    expect(percentError(10000, 10000)).toBe(0);
  });
  it('treats 0 vs 0 as exact and anything vs 0 as infinitely wrong', () => {
    expect(percentError(0, 0)).toBe(0);
    expect(percentError(5, 0)).toBe(Number.POSITIVE_INFINITY);
  });
  it('2% is inclusive and decided with integers', () => {
    expect(withinTolerance(10200, 10000)).toBe(true);
    expect(withinTolerance(10201, 10000)).toBe(false);
    expect(withinTolerance(9800, 10000)).toBe(true);
    expect(withinTolerance(9799, 10000)).toBe(false);
    // 2% of 7 steps is 0.14: only an exact match passes.
    expect(withinTolerance(7, 7)).toBe(true);
    expect(withinTolerance(8, 7)).toBe(false);
    expect(withinTolerance(0, 0)).toBe(true);
    expect(withinTolerance(1, 0)).toBe(false);
  });
  it('formats for the table', () => {
    expect(formatPercentError(10200, 10000)).toBe('2.0%');
    expect(formatPercentError(10015, 10000)).toBe('0.2%');
    expect(formatPercentError(10014, 10000)).toBe('0.1%');
    expect(formatPercentError(0, 0)).toBe('0.0%');
    expect(formatPercentError(1, 0)).toBe('n/a (Health 0)');
  });
});

describe('evaluateDay', () => {
  const base = {
    userId: 'u1',
    name: 'Jay',
    group: 'watch' as const,
    localDate: '2027-01-10',
    tz: NY,
    sources: ["Jay's Apple Watch", "Jay's iPhone"],
  };
  it('measures a day with a counted total and a Health number', () => {
    const d = evaluateDay({
      ...base,
      countedSteps: 10100,
      healthSteps: 10000,
      syncTimes: ['2027-01-10T20:00:00Z', '2027-01-11T13:05:00Z', '2027-01-11T15:00:00Z'],
    });
    expect(d.syncedByLock).toBe(true);
    expect(d.firstSyncAfterDayEnd).toBe('2027-01-11T13:05:00.000Z');
    expect(d.error).toEqual({ kind: 'measured', percent: 1, within: true });
  });
  it('reports no Health number instead of guessing', () => {
    const d = evaluateDay({ ...base, countedSteps: 10100, healthSteps: null, syncTimes: [] });
    expect(d.syncedByLock).toBe(false);
    expect(d.firstSyncAfterDayEnd).toBeNull();
    expect(d.error).toEqual({ kind: 'no-health' });
  });
  it('counts a missing daily_stats row as 0 counted steps against the Health number', () => {
    const d = evaluateDay({ ...base, countedSteps: null, healthSteps: 8000, syncTimes: [] });
    expect(d.error).toEqual({ kind: 'measured', percent: 100, within: false });
  });
  it('shows the first sync after the day ended even when it came after the lock', () => {
    const d = evaluateDay({
      ...base,
      countedSteps: 1,
      healthSteps: 1,
      syncTimes: ['2027-01-11T18:00:00Z'],
    });
    expect(d.syncedByLock).toBe(false);
    expect(d.firstSyncAfterDayEnd).toBe('2027-01-11T18:00:00.000Z');
  });
});

// ---------------------------------------------------------------- summary
function day(
  group: 'watch' | 'phone',
  synced: boolean,
  error: 'within' | 'over' | 'no-health',
): EvaluatedDay {
  return {
    userId: `${group}-x`,
    name: group,
    group,
    localDate: '2027-01-10',
    tz: NY,
    countedSteps: 100,
    healthSteps: error === 'no-health' ? null : 100,
    sources: [],
    syncedByLock: synced,
    firstSyncAfterDayEnd: null,
    error:
      error === 'no-health'
        ? { kind: 'no-health' }
        : { kind: 'measured', percent: error === 'within' ? 0 : 5, within: error === 'within' },
  };
}
const repeat = <T>(n: number, f: () => T): T[] => Array.from({ length: n }, f);

describe('summarize: the two Phase 0 exit lines (PLAN §16)', () => {
  it('passes at exactly 95% synced and 90% within 2%, in both groups', () => {
    const watch = [
      ...repeat(19, () => day('watch', true, 'within')),
      day('watch', false, 'within'),
    ]; // 19/20 = 95%
    const phone = [
      ...repeat(9, () => day('phone', true, 'within')),
      day('phone', true, 'over'),
      ...repeat(10, () => day('phone', true, 'within')),
    ]; // 20/20 synced, 19/20 within
    const s = summarize([...watch, ...phone]);
    expect(s.groups.watch).toMatchObject({
      testers: 1,
      playerDays: 20,
      synced: 19,
      measured: 20,
      within: 20,
    });
    expect(s.syncLine.pass).toBe(true);
    expect(s.errorLine.pass).toBe(true);
  });

  it('fails the sync line when one group is under 95%, even if overall is above', () => {
    const watch = repeat(40, () => day('watch', true, 'within'));
    const phone = [
      ...repeat(18, () => day('phone', true, 'within')),
      ...repeat(2, () => day('phone', false, 'within')),
    ]; // 90%
    const s = summarize([...watch, ...phone]);
    expect(s.syncLine.pass).toBe(false);
    expect(s.syncLine.reasons).toEqual(['Phone only: 18/20 synced by lock (90.0%), needs 95%']);
    expect(s.errorLine.pass).toBe(true);
  });

  it('fails the error line under 90% within 2%', () => {
    const watch = [
      ...repeat(8, () => day('watch', true, 'within')),
      ...repeat(2, () => day('watch', true, 'over')),
    ]; // 80%
    const phone = repeat(10, () => day('phone', true, 'within'));
    const s = summarize([...watch, ...phone]);
    expect(s.errorLine.pass).toBe(false);
    expect(s.errorLine.reasons).toEqual(['Watch wearers: 8/10 days within 2% (80.0%), needs 90%']);
  });

  it('leaves days with no Health number out of the error line, and reports how many', () => {
    const watch = [
      ...repeat(9, () => day('watch', true, 'within')),
      ...repeat(5, () => day('watch', true, 'no-health')),
    ];
    const phone = repeat(10, () => day('phone', true, 'within'));
    const s = summarize([...watch, ...phone]);
    expect(s.groups.watch).toMatchObject({ playerDays: 14, measured: 9, within: 9, noHealth: 5 });
    expect(s.errorLine.pass).toBe(true);
  });

  it('fails the error line for a group with no Health numbers at all', () => {
    const watch = repeat(5, () => day('watch', true, 'no-health'));
    const phone = repeat(5, () => day('phone', true, 'within'));
    const s = summarize([...watch, ...phone]);
    expect(s.errorLine.pass).toBe(false);
    expect(s.errorLine.reasons).toEqual(['Watch wearers: no days with a Health number']);
  });

  it('fails both lines when a group has no testers', () => {
    const s = summarize(repeat(7, () => day('watch', true, 'within')));
    expect(s.groups.phone).toMatchObject({ testers: 0, playerDays: 0 });
    expect(s.syncLine.reasons).toEqual(['Phone only: no testers']);
    expect(s.errorLine.reasons).toEqual(['Phone only: no testers']);
    expect(s.syncLine.pass).toBe(false);
    expect(s.errorLine.pass).toBe(false);
  });

  it('counts distinct testers per group', () => {
    const a = { ...day('watch', true, 'within'), userId: 'a' };
    const b = { ...day('watch', true, 'within'), userId: 'b' };
    expect(summarize([a, a, b]).groups.watch.testers).toBe(2);
  });
});
