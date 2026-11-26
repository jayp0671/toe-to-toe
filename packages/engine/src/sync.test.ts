import { describe, expect, it } from 'vitest';
import watchAndPhone from '../../../tests/fixtures/watch-and-phone-same-walk.json';
import manualEntry from '../../../tests/fixtures/manual-entry.json';
import {
  compareVersions,
  describeIssue,
  isOutdatedShortcut,
  oversizedMetric,
  SyncBodySchema,
  type SyncBody,
} from './schemas/sync.ts';
import {
  dayStatus,
  mergeHours,
  planSync,
  screenSync,
  sourcesByDate,
  stubPointsHundredths,
} from './sync.ts';
import { isLocked, toInstant } from './time.ts';

const NY = 'America/New_York';
const parse = (raw: unknown): SyncBody => SyncBodySchema.parse(raw);
/** 9:00 AM ET Jan 11: Jan 10 is finalizing, Jan 9 is locked. */
const NOW = toInstant('2027-01-11T14:00:00Z');
const lockedByTime = (date: string) => isLocked(date, NY, NOW);

const body = (steps: unknown[], extra: Record<string, unknown> = {}) => ({
  v: 1,
  kind: 'samples',
  sent_at: '2027-01-11T09:00:00-05:00',
  device_tz: NY,
  shortcut_version: '1.0',
  metrics: { steps },
  ...extra,
});
const step = (s: string, e: string, n: number, src = "Jay's iPhone") => ({ s, e, n, src });

describe('SyncBodySchema (A5)', () => {
  it('accepts the fixtures and strips the extra fixture key', () => {
    const parsed = parse(watchAndPhone);
    expect(parsed.kind).toBe('samples');
    expect('fixture' in parsed).toBe(false);
    expect(() => parse(manualEntry)).not.toThrow();
  });

  it('accepts kind "hours"', () => {
    const parsed = parse({
      ...body([]),
      kind: 'hours',
      metrics: { steps: [{ h: '2027-01-10T08:00:00-05:00', n: 1520, src: 'x' }] },
    });
    expect(parsed.kind).toBe('hours');
  });

  it.each([
    [{ ...body([]), v: 2 }, 'v:'],
    [{ ...body([]), kind: 'minutes' }, 'kind:'],
    [{ ...body([]), sent_at: '2027-01-11T09:00:00' }, 'sent_at:'],
    [{ ...body([]), shortcut_version: 'one' }, 'shortcut_version:'],
    [{ ...body([]), metrics: undefined }, 'metrics:'],
    [
      body([step('2027-01-10T08:00:00-05:00', '2027-01-10T08:10:00-05:00', 1.5)]),
      'metrics.steps[0].n:',
    ],
    [
      body([step('2027-01-10T08:00:00-05:00', '2027-01-10T08:10:00-05:00', -1)]),
      'metrics.steps[0].n:',
    ],
    [body([step('2027-01-10T08:00:00', '2027-01-10T08:10:00-05:00', 1)]), 'metrics.steps[0].s:'],
    [
      body([step('2027-01-10T08:10:00-05:00', '2027-01-10T08:00:00-05:00', 1)]),
      'metrics.steps[0].e:',
    ],
    [
      body([step('2027-01-10T08:00:00-05:00', '2027-01-10T08:10:00-05:00', 1, '')]),
      'metrics.steps[0].src:',
    ],
  ])('rejects %j naming the field', (raw, field) => {
    const result = SyncBodySchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(describeIssue(result.error)).toMatch(
        new RegExp(`^${field.replace(/[[\]]/g, '\\$&')}`),
      );
  });

  it('allows fractional distance', () => {
    expect(() => parse(watchAndPhone)).not.toThrow();
  });
});

describe('limits and version checks on the raw body', () => {
  it('compares dotted versions', () => {
    expect(compareVersions('0.9', '1.0')).toBeLessThan(0);
    expect(compareVersions('1.0', '1')).toBe(0);
    expect(compareVersions('1.1', '1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.10', '1.9')).toBeGreaterThan(0);
  });

  it('flags only well-formed old versions as outdated', () => {
    expect(isOutdatedShortcut({ shortcut_version: '0.9' })).toBe(true);
    expect(isOutdatedShortcut({ shortcut_version: '1.0' })).toBe(false);
    expect(isOutdatedShortcut({ shortcut_version: '1.1' })).toBe(false);
    expect(isOutdatedShortcut({ shortcut_version: 'beta' })).toBe(false);
    expect(isOutdatedShortcut(null)).toBe(false);
  });

  it('finds a metric over 5,000 items', () => {
    const many = Array.from({ length: 5001 }, () => ({}));
    expect(oversizedMetric({ metrics: { steps: many.slice(1) } })).toBeUndefined();
    expect(oversizedMetric({ metrics: { flights: many } })).toBe('flights');
    expect(oversizedMetric({ metrics: 'x' })).toBeUndefined();
  });
});

describe('screenSync and planSync', () => {
  it('runs the fixture through dedup unchanged when nothing is locked', () => {
    const screened = screenSync(parse(watchAndPhone), NY, NOW);
    expect(screened.dates).toEqual(['2027-01-10']);
    const plan = planSync(screened, lockedByTime);
    expect(plan.dates).toEqual(['2027-01-10']);
    expect(plan.hours).toEqual(
      watchAndPhone.fixture.expected.hours.map((h) => ({ ...h, localDate: '2027-01-10' })),
    );
    expect(plan.hours.every((h) => h.localDate === '2027-01-10')).toBe(true);
    expect(plan.ignored).toEqual({ locked_days: 0, outside_window: 0, manual: 0 });
  });

  it('counts manual entries', () => {
    const plan = planSync(screenSync(parse(manualEntry), NY, NOW), lockedByTime);
    expect(plan.ignored.manual).toBe(manualEntry.fixture.expected.ignored.manual);
    expect(plan.hours.reduce((sum, h) => sum + h.steps, 0)).toBe(2000);
  });

  it('ignores items for locked dates and older than 48 hours, each counted once', () => {
    const raw = body([
      // Jan 8: ended more than 48 h before 14:00Z Jan 11 (outside the window, also locked).
      step('2027-01-08T08:00:00-05:00', '2027-01-08T08:10:00-05:00', 100),
      // Jan 9: locked at noon Jan 10.
      step('2027-01-09T20:00:00-05:00', '2027-01-09T20:10:00-05:00', 200),
      // Jan 10 and Jan 11: open.
      step('2027-01-10T20:00:00-05:00', '2027-01-10T20:10:00-05:00', 300),
      step('2027-01-11T08:00:00-05:00', '2027-01-11T08:10:00-05:00', 400),
      step('2027-01-11T08:00:00-05:00', '2027-01-11T08:10:00-05:00', 999, 'Health'),
    ]);
    const screened = screenSync(parse(raw), NY, NOW);
    expect(screened.dates).toEqual(['2027-01-09', '2027-01-10', '2027-01-11']);
    const plan = planSync(screened, lockedByTime);
    expect(plan.ignored).toEqual({ locked_days: 1, outside_window: 1, manual: 1 });
    expect(plan.dates).toEqual(['2027-01-10', '2027-01-11']);
    expect(plan.hours.map((h) => h.steps)).toEqual([300, 400]);
  });

  it('a date locked by status (review) is ignored before noon too', () => {
    const raw = body([step('2027-01-10T20:00:00-05:00', '2027-01-10T20:10:00-05:00', 300)]);
    const plan = planSync(screenSync(parse(raw), NY, NOW), (d) => d === '2027-01-10');
    expect(plan.ignored.locked_days).toBe(1);
    expect(plan.hours).toEqual([]);
  });

  it('a sample from an open day into a locked day keeps only its open part', () => {
    // Jan 10 23:50 to Jan 11 00:10 ET, with Jan 11 treated as locked.
    const raw = body([step('2027-01-10T23:50:00-05:00', '2027-01-11T00:10:00-05:00', 200)]);
    const plan = planSync(screenSync(parse(raw), NY, NOW), (d) => d === '2027-01-11');
    expect(plan.ignored.locked_days).toBe(0);
    expect(plan.hours).toEqual([
      {
        hourStartUtc: '2027-01-11T04:00:00Z',
        steps: 100,
        flights: 0,
        distance_m: 0,
        localDate: '2027-01-10',
      },
    ]);
  });

  it('kind "hours" is screened by the hour it covers', () => {
    const raw = {
      ...body([]),
      kind: 'hours',
      metrics: {
        steps: [
          { h: '2027-01-09T10:00:00-05:00', n: 50, src: 'p' },
          { h: '2027-01-11T08:00:00-05:00', n: 70, src: 'p' },
        ],
      },
    };
    const plan = planSync(screenSync(parse(raw), NY, NOW), lockedByTime);
    expect(plan.ignored).toEqual({ locked_days: 1, outside_window: 0, manual: 0 });
    expect(plan.hours.map((h) => h.steps)).toEqual([70]);
  });
});

describe('helpers', () => {
  it('mergeHours lets a re-sent hour replace the stored one', () => {
    const merged = mergeHours(
      [
        { hourStartUtc: '2027-01-10T13:00:00+00:00', steps: 1, flights: 0, distance_m: 0 },
        { hourStartUtc: '2027-01-10T14:00:00+00:00', steps: 2, flights: 0, distance_m: 0 },
      ],
      [{ hourStartUtc: '2027-01-10T13:00:00Z', steps: 5, flights: 1, distance_m: 9 }],
    );
    expect(merged).toEqual([
      { hourStartUtc: '2027-01-10T13:00:00Z', steps: 5, flights: 1, distance_m: 9 },
      { hourStartUtc: '2027-01-10T14:00:00Z', steps: 2, flights: 0, distance_m: 0 },
    ]);
  });

  it('sourcesByDate lists each date once per source', () => {
    const map = sourcesByDate(
      [
        { hourStartUtc: '2027-01-10T13:00:00Z', sourceName: 'b' },
        { hourStartUtc: '2027-01-10T14:00:00Z', sourceName: 'a' },
        { hourStartUtc: '2027-01-10T15:00:00Z', sourceName: 'b' },
        { hourStartUtc: '2027-01-11T05:00:00Z', sourceName: 'c' },
      ],
      NY,
    );
    expect(Object.fromEntries(map)).toEqual({ '2027-01-10': ['a', 'b'], '2027-01-11': ['c'] });
  });

  it('dayStatus is live during the local day and finalizing after midnight', () => {
    expect(dayStatus('2027-01-11', NY, NOW)).toBe('live');
    expect(dayStatus('2027-01-10', NY, NOW)).toBe('finalizing');
    expect(dayStatus('2027-01-10', NY, toInstant('2027-01-11T04:59:59Z'))).toBe('live');
    expect(dayStatus('2027-01-10', NY, toInstant('2027-01-11T05:00:00Z'))).toBe('finalizing');
  });

  it('stub points are steps x 1 hundredth', () => {
    expect(stubPointsHundredths(10431)).toBe(10431);
  });
});
