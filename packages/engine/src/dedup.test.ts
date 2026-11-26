import { describe, expect, it } from 'vitest';
import {
  dailyTotals,
  dedup,
  pickWinner,
  spreadShare,
  toCount,
  type DedupInput,
  type DedupResult,
  type HourSample,
  type Metric,
  type Sample,
} from './dedup.ts';

import crossesMidnight from '../../../tests/fixtures/crosses-midnight.json';
import dstSpringDay from '../../../tests/fixtures/dst-spring-day.json';
import freakDay40k from '../../../tests/fixtures/freak-day-40k.json';
import kolkataHalfHour from '../../../tests/fixtures/kolkata-half-hour.json';
import manualEntry from '../../../tests/fixtures/manual-entry.json';
import phoneOnly from '../../../tests/fixtures/phone-only.json';
import thirdPartyBand from '../../../tests/fixtures/third-party-band.json';
import watchAndPhoneSameWalk from '../../../tests/fixtures/watch-and-phone-same-walk.json';
import watchOnChargerMidday from '../../../tests/fixtures/watch-on-charger-midday.json';

/** Shape of a tests/fixtures file: an A5 /sync body plus a `fixture` block with expectations. */
interface FixtureFile {
  kind: string;
  metrics: Partial<Record<Metric, Sample[]>>;
  fixture: {
    home_tz: string;
    expected: {
      ignored: { manual: number };
      days: { date: string; steps: number; flights: number; distance_m: number }[];
      hours?: DedupResult['hours'];
      sourceHours?: DedupResult['sourceHours'];
    };
  };
}

const FIXTURES: Record<string, FixtureFile> = {
  'watch-and-phone-same-walk': watchAndPhoneSameWalk,
  'phone-only': phoneOnly,
  'watch-on-charger-midday': watchOnChargerMidday,
  'third-party-band': thirdPartyBand,
  'manual-entry': manualEntry,
  'crosses-midnight': crossesMidnight,
  'dst-spring-day': dstSpringDay,
  'kolkata-half-hour': kolkataHalfHour,
  'freak-day-40k': freakDay40k,
};

function inputOf(f: FixtureFile): DedupInput {
  expect(f.kind).toBe('samples');
  return { kind: 'samples', homeTz: f.fixture.home_tz, metrics: f.metrics };
}

const NY = 'America/New_York';
const W = "Jay's Apple Watch";
const P = "Jay's iPhone";

function steps(...samples: Sample[]): DedupInput {
  return { kind: 'samples', homeTz: NY, metrics: { steps: samples } };
}

describe('fixtures (Appendix A3 layer 4)', () => {
  it.each(Object.entries(FIXTURES))('%s matches its expected totals exactly', (_name, f) => {
    const result = dedup(inputOf(f));
    const { expected } = f.fixture;
    expect(result.ignored).toEqual(expected.ignored);
    expect(
      result.days.map((d) => ({
        date: d.localDate,
        steps: d.steps,
        flights: d.flights,
        distance_m: d.distance_m,
      })),
    ).toEqual(expected.days);
    if (expected.hours) expect(result.hours).toEqual(expected.hours);
    if (expected.sourceHours) expect(result.sourceHours).toEqual(expected.sourceHours);
  });

  it.each(Object.entries(FIXTURES))('%s gives identical output when run twice', (_name, f) => {
    expect(dedup(inputOf(f))).toEqual(dedup(inputOf(f)));
  });

  it.each(Object.entries(FIXTURES))('%s does not depend on sample order', (_name, f) => {
    const reversed: DedupInput = {
      kind: 'samples',
      homeTz: f.fixture.home_tz,
      metrics: Object.fromEntries(
        Object.entries(f.metrics).map(([m, list]) => [m, [...list].reverse()]),
      ),
    };
    expect(dedup(reversed)).toEqual(dedup(inputOf(f)));
  });

  it('per-source hours always add up to the raw counted samples', () => {
    for (const f of Object.values(FIXTURES)) {
      const result = dedup(inputOf(f));
      const raw = (f.metrics.steps ?? [])
        .filter((s) => s.src !== 'Health')
        .reduce((a, s) => a + s.n, 0);
      expect(result.sourceHours.reduce((a, h) => a + h.steps, 0)).toBe(raw);
      // De-duplicated days equal de-duplicated hours: nothing is lost when splitting by day.
      expect(result.days.reduce((a, d) => a + d.steps, 0)).toBe(
        result.hours.reduce((a, h) => a + h.steps, 0),
      );
    }
  });
});

describe('spreadShare', () => {
  it('spreads evenly and hands leftovers to the earliest minutes', () => {
    // 7 over 3 minutes: 3, 2, 2.
    expect([0, 1, 2].map((i) => spreadShare(7, 3, i, i + 1))).toEqual([3, 2, 2]);
    expect(spreadShare(7, 3, 0, 3)).toBe(7);
    expect(spreadShare(2001, 20, 0, 10)).toBe(1001);
    expect(spreadShare(2001, 20, 10, 20)).toBe(1000);
    expect(spreadShare(5000, 60, 0, 30)).toBe(2510);
    expect(spreadShare(0, 5, 0, 5)).toBe(0);
  });

  it('gives fewer units than minutes to the first minutes only', () => {
    expect([0, 1, 2, 3].map((i) => spreadShare(2, 4, i, i + 1))).toEqual([1, 1, 0, 0]);
  });
});

describe('toCount', () => {
  it('rounds distance_m half up to whole metres (Jay, 2026-11-26)', () => {
    expect(toCount('distance_m', 640.5)).toBe(641);
    expect(toCount('distance_m', 640.4)).toBe(640);
    expect(toCount('distance_m', 640.49)).toBe(640);
    expect(toCount('distance_m', 0.5)).toBe(1);
    expect(toCount('distance_m', 2.5)).toBe(3);
    expect(toCount('distance_m', 0.49999999999999994)).toBe(0);
    expect(toCount('distance_m', 12)).toBe(12);
  });

  it('rounds each distance sample before spreading, not the total', () => {
    // Three 0.5 m samples are 1 m each (3 m), not round(1.5) = 2 m.
    const r = dedup({
      kind: 'samples',
      homeTz: NY,
      metrics: {
        distance_m: [
          { s: '2027-01-10T08:00:00-05:00', e: '2027-01-10T08:01:00-05:00', n: 0.5, src: P },
          { s: '2027-01-10T08:01:00-05:00', e: '2027-01-10T08:02:00-05:00', n: 0.5, src: P },
          { s: '2027-01-10T08:02:00-05:00', e: '2027-01-10T08:03:00-05:00', n: 0.5, src: P },
        ],
      },
    });
    expect(r.days[0]?.distance_m).toBe(3);
  });

  it('requires whole numbers for steps and flights', () => {
    expect(toCount('steps', 912)).toBe(912);
    expect(() => toCount('steps', 912.5)).toThrow(RangeError);
    expect(() => toCount('flights', 1.2)).toThrow(RangeError);
  });

  it('rejects negative and non-finite counts', () => {
    expect(() => toCount('steps', -1)).toThrow(RangeError);
    expect(() => toCount('distance_m', -0.5)).toThrow(RangeError);
    expect(() => toCount('distance_m', Number.NaN)).toThrow(RangeError);
    expect(() => toCount('steps', Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('pickWinner', () => {
  it('keeps the largest count', () => {
    expect(
      pickWinner(
        new Map([
          [P, 90],
          [W, 120],
        ]),
      ),
    ).toEqual({ src: W, n: 120 });
  });

  it('breaks ties by source name (code-point order), independent of insertion order', () => {
    const a = new Map([
      ['b-band', 50],
      ['a-phone', 50],
    ]);
    const b = new Map([
      ['a-phone', 50],
      ['b-band', 50],
    ]);
    expect(pickWinner(a)).toEqual({ src: 'a-phone', n: 50 });
    expect(pickWinner(b)).toEqual({ src: 'a-phone', n: 50 });
  });

  it('returns undefined for an empty minute', () => {
    expect(pickWinner(new Map())).toBeUndefined();
  });
});

describe('dedup (samples)', () => {
  it('covers every UTC minute the sample touches, including partial ones', () => {
    // 08:01:00-08:09:30 covers 08:01..08:09 = 9 minutes (A5 example).
    const r = dedup(
      steps({ s: '2027-01-10T08:01:00-05:00', e: '2027-01-10T08:09:30-05:00', n: 912, src: W }),
    );
    expect(r.hours).toEqual([
      { hourStartUtc: '2027-01-10T13:00:00Z', steps: 912, flights: 0, distance_m: 0 },
    ]);
    const r2 = dedup(
      steps(
        { s: '2027-01-10T08:01:00-05:00', e: '2027-01-10T08:09:30-05:00', n: 909, src: W },
        { s: '2027-01-10T08:09:00-05:00', e: '2027-01-10T08:11:00-05:00', n: 400, src: P },
      ),
    );
    // Watch: 101/min for 08:01..08:09. Phone: 200/min for 08:09..08:10. Minute 08:09 → phone.
    expect(r2.hours[0]?.steps).toBe(101 * 8 + 200 + 200);
  });

  it('counts a zero-length sample in the minute it falls in', () => {
    const r = dedup(
      steps({ s: '2027-01-10T08:00:30-05:00', e: '2027-01-10T08:00:30-05:00', n: 40, src: P }),
    );
    expect(r.hours[0]).toEqual({
      hourStartUtc: '2027-01-10T13:00:00Z',
      steps: 40,
      flights: 0,
      distance_m: 0,
    });
  });

  it('adds up overlapping samples from the same source before comparing sources', () => {
    const r = dedup(
      steps(
        { s: '2027-01-10T08:00:00-05:00', e: '2027-01-10T08:01:00-05:00', n: 60, src: P },
        { s: '2027-01-10T08:00:00-05:00', e: '2027-01-10T08:01:00-05:00', n: 50, src: P },
        { s: '2027-01-10T08:00:00-05:00', e: '2027-01-10T08:01:00-05:00', n: 100, src: W },
      ),
    );
    expect(r.hours[0]?.steps).toBe(110);
    expect(r.sourceHours.map((h) => [h.sourceName, h.steps])).toEqual([
      [W, 100],
      [P, 110],
    ]);
  });

  it('keeps the winner per metric independently', () => {
    const span = { s: '2027-01-10T08:00:00-05:00', e: '2027-01-10T08:01:00-05:00' };
    const r = dedup({
      kind: 'samples',
      homeTz: NY,
      metrics: {
        steps: [
          { ...span, n: 100, src: W },
          { ...span, n: 90, src: P },
        ],
        flights: [
          { ...span, n: 1, src: W },
          { ...span, n: 2, src: P },
        ],
      },
    });
    expect(r.hours[0]).toMatchObject({ steps: 100, flights: 2 });
  });

  it('drops source "Health" exactly, not sources that merely contain it', () => {
    const r = dedup(
      steps(
        { s: '2027-01-10T08:00:00-05:00', e: '2027-01-10T08:01:00-05:00', n: 100, src: 'Health' },
        {
          s: '2027-01-10T09:00:00-05:00',
          e: '2027-01-10T09:01:00-05:00',
          n: 70,
          src: 'Health Mate',
        },
      ),
    );
    expect(r.ignored.manual).toBe(1);
    expect(r.days[0]?.steps).toBe(70);
  });

  it('leaves out hours and days with nothing counted', () => {
    const r = dedup(
      steps({ s: '2027-01-10T08:00:00-05:00', e: '2027-01-10T08:10:00-05:00', n: 0, src: P }),
    );
    expect(r).toEqual({ sourceHours: [], hours: [], days: [], ignored: { manual: 0 } });
    expect(dedup({ kind: 'samples', homeTz: NY, metrics: {} }).hours).toEqual([]);
  });

  it('rejects a sample that ends before it starts', () => {
    expect(() =>
      dedup(
        steps({ s: '2027-01-10T08:10:00-05:00', e: '2027-01-10T08:00:00-05:00', n: 5, src: P }),
      ),
    ).toThrow(RangeError);
  });

  it('rejects instants without an offset and bad home zones', () => {
    expect(() =>
      dedup(steps({ s: '2027-01-10T08:00:00', e: '2027-01-10T08:01:00-05:00', n: 5, src: P })),
    ).toThrow(RangeError);
    expect(() => dedup({ kind: 'samples', homeTz: 'EST', metrics: { steps: [] } })).toThrow(
      RangeError,
    );
  });
});

describe('dedup (hours fallback)', () => {
  const hours = (...items: HourSample[]): DedupInput => ({
    kind: 'hours',
    homeTz: NY,
    metrics: { steps: items },
  });

  it('keeps the largest source per hour', () => {
    const r = dedup(
      hours(
        { h: '2027-01-10T08:00:00-05:00', n: 1520, src: W },
        { h: '2027-01-10T08:00:00-05:00', n: 1400, src: P },
        { h: '2027-01-10T12:00:00-05:00', n: 800, src: P },
      ),
    );
    expect(r.hours).toEqual([
      { hourStartUtc: '2027-01-10T13:00:00Z', steps: 1520, flights: 0, distance_m: 0 },
      { hourStartUtc: '2027-01-10T17:00:00Z', steps: 800, flights: 0, distance_m: 0 },
    ]);
    expect(r.sourceHours).toHaveLength(3);
    expect(r.days).toEqual([{ localDate: '2027-01-10', steps: 2320, flights: 0, distance_m: 0 }]);
  });

  it('drops manual entries and rounds distance the same way', () => {
    const r = dedup({
      kind: 'hours',
      homeTz: NY,
      metrics: {
        steps: [{ h: '2027-01-10T08:00:00-05:00', n: 3000, src: 'Health' }],
        distance_m: [{ h: '2027-01-10T08:00:00-05:00', n: 640.5, src: W }],
      },
    });
    expect(r.ignored.manual).toBe(1);
    expect(r.hours).toEqual([
      { hourStartUtc: '2027-01-10T13:00:00Z', steps: 0, flights: 0, distance_m: 641 },
    ]);
  });

  it('spreads a half-hour-offset hour (Kolkata phone) over the two UTC hours it covers', () => {
    // 08:00 IST = 02:30Z, so 600 steps split 300 / 300 between 02:00Z and 03:00Z.
    const r = dedup({
      kind: 'hours',
      homeTz: 'Asia/Kolkata',
      metrics: { steps: [{ h: '2027-01-10T08:00:00+05:30', n: 600, src: "Priya's iPhone" }] },
    });
    expect(r.hours.map((h) => [h.hourStartUtc, h.steps])).toEqual([
      ['2027-01-10T02:00:00Z', 300],
      ['2027-01-10T03:00:00Z', 300],
    ]);
  });

  it('is deterministic', () => {
    const input = hours(
      { h: '2027-01-10T08:00:00-05:00', n: 100, src: 'b' },
      { h: '2027-01-10T08:00:00-05:00', n: 100, src: 'a' },
    );
    expect(dedup(input)).toEqual(dedup(input));
  });
});

describe('dailyTotals', () => {
  it('sums whole hours into home-zone days', () => {
    expect(
      dailyTotals(
        [
          { hourStartUtc: '2027-01-11T04:00:00Z', steps: 10, flights: 1, distance_m: 5 },
          { hourStartUtc: '2027-01-11T05:00:00Z', steps: 20, flights: 0, distance_m: 7 },
        ],
        NY,
      ),
    ).toEqual([
      { localDate: '2027-01-10', steps: 10, flights: 1, distance_m: 5 },
      { localDate: '2027-01-11', steps: 20, flights: 0, distance_m: 7 },
    ]);
  });

  it('splits an hour that straddles a half-hour-zone midnight by minute, exactly', () => {
    const days = dailyTotals(
      [{ hourStartUtc: '2027-01-10T18:00:00Z', steps: 5000, flights: 1, distance_m: 61 }],
      'Asia/Kolkata',
    );
    expect(days).toEqual([
      { localDate: '2027-01-10', steps: 2510, flights: 1, distance_m: 31 },
      { localDate: '2027-01-11', steps: 2490, flights: 0, distance_m: 30 },
    ]);
  });

  it('returns days in date order regardless of hour order', () => {
    const days = dailyTotals(
      [
        { hourStartUtc: '2027-01-12T15:00:00Z', steps: 1, flights: 0, distance_m: 0 },
        { hourStartUtc: '2027-01-10T15:00:00Z', steps: 2, flights: 0, distance_m: 0 },
      ],
      NY,
    );
    expect(days.map((d) => d.localDate)).toEqual(['2027-01-10', '2027-01-12']);
  });

  it('rejects hour rows that are not on a UTC hour', () => {
    expect(() =>
      dailyTotals(
        [{ hourStartUtc: '2027-01-10T18:30:00Z', steps: 1, flights: 0, distance_m: 0 }],
        NY,
      ),
    ).toThrow(RangeError);
  });
});
