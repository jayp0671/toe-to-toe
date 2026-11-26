import { DateTime, Interval } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  dayWindow,
  isLocked,
  localDateOf,
  lockInstant,
  minutesOf,
  splitIntervalByLocalDay,
} from './time';

const NY = 'America/New_York';
const LA = 'America/Los_Angeles';
const HALIFAX = 'America/Halifax';
const VANCOUVER = 'America/Vancouver';
const KOLKATA = 'Asia/Kolkata';

const utc = (iso: string) => DateTime.fromISO(iso, { zone: 'utc' });
const iso = (dt: DateTime) => dt.toUTC().toISO();
/** Format an instant on the Eastern clock, as the §4 table does. */
const eastern = (dt: DateTime) => dt.setZone(NY).toFormat('LLL d, h:mm a');

describe('§4 lock-time example (Jan 10, shown on the Eastern clock)', () => {
  const rows = [
    {
      player: 'A',
      zone: NY,
      runs: ['Jan 10, 12:00 AM', 'Jan 10, 11:59 PM'],
      locks: 'Jan 11, 12:00 PM',
    },
    {
      player: 'B',
      zone: LA,
      runs: ['Jan 10, 3:00 AM', 'Jan 11, 2:59 AM'],
      locks: 'Jan 11, 3:00 PM',
    },
    {
      player: 'C',
      zone: HALIFAX,
      runs: ['Jan 9, 11:00 PM', 'Jan 10, 10:59 PM'],
      locks: 'Jan 11, 11:00 AM',
    },
  ] as const;

  for (const row of rows) {
    it(`Player ${row.player} (${row.zone}): day runs ${row.runs[0]} – ${row.runs[1]} ET, locks ${row.locks} ET`, () => {
      const { start, end } = dayWindow('2027-01-10', row.zone);
      expect(eastern(start)).toBe(row.runs[0]);
      // The table shows the last minute of the day; the window itself is half-open.
      expect(eastern(end.minus({ minutes: 1 }))).toBe(row.runs[1]);
      expect(end.diff(start, 'hours').hours).toBe(24);
      expect(eastern(lockInstant('2027-01-10', row.zone))).toBe(row.locks);
    });
  }

  it('Game A vs B is final Jan 11 at 3:00 PM ET (the later of the two locks)', () => {
    const a = lockInstant('2027-01-10', NY);
    const b = lockInstant('2027-01-10', LA);
    expect(eastern(DateTime.max(a, b))).toBe('Jan 11, 3:00 PM');
  });

  // tzdata 2026 and later: British Columbia stopped changing clocks after Mar 8 2026 and stays on
  // UTC-7 all year, so in winter Vancouver is one hour ahead of Los Angeles. The home-zone rule is
  // unchanged; only the IANA data differs from the §4 note that Vancouver works like Los Angeles.
  it('Vancouver in Jan 2027 (permanent UTC-7): day runs 2:00 AM ET, locks Jan 11, 2:00 PM ET', () => {
    const { start, end } = dayWindow('2027-01-10', VANCOUVER);
    expect(eastern(start)).toBe('Jan 10, 2:00 AM');
    expect(eastern(end.minus({ minutes: 1 }))).toBe('Jan 11, 1:59 AM');
    expect(eastern(lockInstant('2027-01-10', VANCOUVER))).toBe('Jan 11, 2:00 PM');
  });

  it('Vancouver in Jan 2026 (still on PST) matched Los Angeles', () => {
    expect(eastern(dayWindow('2026-01-10', VANCOUVER).start)).toBe('Jan 10, 3:00 AM');
    expect(eastern(lockInstant('2026-01-10', VANCOUVER))).toBe('Jan 11, 3:00 PM');
    expect(+lockInstant('2026-01-10', VANCOUVER)).toBe(+lockInstant('2026-01-10', LA));
  });
});

describe('dayWindow: midnight to midnight in the home zone, [start, end)', () => {
  it.each([
    [NY, '2027-01-10T05:00:00.000Z', '2027-01-11T05:00:00.000Z'],
    [HALIFAX, '2027-01-10T04:00:00.000Z', '2027-01-11T04:00:00.000Z'],
    [VANCOUVER, '2027-01-10T07:00:00.000Z', '2027-01-11T07:00:00.000Z'],
    [KOLKATA, '2027-01-09T18:30:00.000Z', '2027-01-10T18:30:00.000Z'],
  ])('%s, Jan 10 2027', (zone, start, end) => {
    const w = dayWindow('2027-01-10', zone);
    expect(iso(w.start)).toBe(start);
    expect(iso(w.end)).toBe(end);
  });

  it('returns UTC instants', () => {
    const w = dayWindow('2027-07-04', KOLKATA);
    expect(w.start.zoneName).toBe('UTC');
    expect(w.end.zoneName).toBe('UTC');
  });

  it('summer (daylight time) boundaries', () => {
    expect(iso(dayWindow('2027-07-04', NY).start)).toBe('2027-07-04T04:00:00.000Z');
    expect(iso(dayWindow('2027-07-04', HALIFAX).start)).toBe('2027-07-04T03:00:00.000Z');
    expect(iso(dayWindow('2027-07-04', VANCOUVER).start)).toBe('2027-07-04T07:00:00.000Z');
    // India has no daylight saving.
    expect(iso(dayWindow('2027-07-04', KOLKATA).start)).toBe('2027-07-03T18:30:00.000Z');
  });

  it('consecutive days tile with no gap or overlap', () => {
    for (const zone of [NY, HALIFAX, VANCOUVER, KOLKATA]) {
      expect(+dayWindow('2027-03-13', zone).end).toBe(+dayWindow('2027-03-14', zone).start);
      expect(+dayWindow('2027-03-14', zone).end).toBe(+dayWindow('2027-03-15', zone).start);
    }
  });

  it('rejects bad dates and zones', () => {
    expect(() => dayWindow('2027-02-30', NY)).toThrow(RangeError);
    expect(() => dayWindow('2027-1-10', NY)).toThrow(RangeError);
    expect(() => dayWindow('2027-01-10T00:00', NY)).toThrow(RangeError);
    expect(() => dayWindow('2027-01-10', 'Eastern')).toThrow(RangeError);
    expect(() => dayWindow('2027-01-10', 'EST')).toThrow(RangeError);
    expect(() => dayWindow('2027-01-10', 'UTC-5')).toThrow(RangeError);
  });
});

describe('daylight saving 2027', () => {
  const observing = [NY, HALIFAX, LA];

  it.each(observing)('spring-forward day (Mar 14) has 23 hours in %s', (zone) => {
    const { start, end } = dayWindow('2027-03-14', zone);
    expect(end.diff(start, 'hours').hours).toBe(23);
    expect(minutesOf({ start, end })).toBe(23 * 60);
  });

  it.each(observing)('fall-back day (Nov 7) has 25 hours in %s', (zone) => {
    const { start, end } = dayWindow('2027-11-07', zone);
    expect(end.diff(start, 'hours').hours).toBe(25);
    expect(minutesOf({ start, end })).toBe(25 * 60);
  });

  it('Kolkata and Vancouver (no DST from 2027) keep 24-hour days on those dates', () => {
    for (const zone of [KOLKATA, VANCOUVER]) {
      for (const date of ['2027-03-14', '2027-11-07']) {
        const { start, end } = dayWindow(date, zone);
        expect(end.diff(start, 'hours').hours).toBe(24);
      }
    }
  });

  it("Vancouver's last spring-forward day (Mar 8 2026) had 23 hours; Nov 1 2026 had 24", () => {
    const spring = dayWindow('2026-03-08', VANCOUVER);
    expect(spring.end.diff(spring.start, 'hours').hours).toBe(23);
    const fall = dayWindow('2026-11-01', VANCOUVER);
    expect(fall.end.diff(fall.start, 'hours').hours).toBe(24);
  });

  it('the day before and after a change are 24 hours', () => {
    for (const date of ['2027-03-13', '2027-03-15', '2027-11-06', '2027-11-08']) {
      const { start, end } = dayWindow(date, NY);
      expect(end.diff(start, 'hours').hours).toBe(24);
    }
  });

  it('locks stay at local noon across the change', () => {
    // Mar 13 locks at noon Mar 14 (EDT, UTC-4); Nov 6 locks at noon Nov 7 (EST, UTC-5).
    expect(iso(lockInstant('2027-03-13', NY))).toBe('2027-03-14T16:00:00.000Z');
    expect(iso(lockInstant('2027-11-06', NY))).toBe('2027-11-07T17:00:00.000Z');
  });
});

describe('localDateOf', () => {
  it.each([
    // [instant, zone, local date]
    ['2027-01-10T04:59:59.999Z', NY, '2027-01-09'],
    ['2027-01-10T05:00:00.000Z', NY, '2027-01-10'],
    ['2027-01-10T03:59:59.999Z', HALIFAX, '2027-01-09'],
    ['2027-01-10T04:00:00.000Z', HALIFAX, '2027-01-10'],
    ['2027-01-10T06:59:59.999Z', VANCOUVER, '2027-01-09'],
    ['2027-01-10T07:00:00.000Z', VANCOUVER, '2027-01-10'],
    ['2027-01-09T18:29:59.999Z', KOLKATA, '2027-01-09'],
    ['2027-01-09T18:30:00.000Z', KOLKATA, '2027-01-10'],
  ])('%s in %s is %s', (instant, zone, expected) => {
    expect(localDateOf(utc(instant), zone)).toBe(expected);
    expect(localDateOf(instant, zone)).toBe(expected);
  });

  it('agrees with dayWindow at both edges', () => {
    for (const zone of [NY, HALIFAX, VANCOUVER, KOLKATA]) {
      for (const date of ['2027-01-10', '2027-03-14', '2027-11-07']) {
        const { start, end } = dayWindow(date, zone);
        expect(localDateOf(start, zone)).toBe(date);
        expect(localDateOf(end.minus({ milliseconds: 1 }), zone)).toBe(date);
        expect(localDateOf(end, zone)).not.toBe(date);
      }
    }
  });

  it('rejects ISO strings without an offset (they would depend on the machine zone)', () => {
    expect(() => localDateOf('2027-01-10T12:00:00', NY)).toThrow(RangeError);
    expect(() => localDateOf('nonsense', NY)).toThrow(RangeError);
    expect(() => localDateOf(DateTime.invalid('test'), NY)).toThrow(RangeError);
  });
});

describe('travel: the home zone always wins over the phone zone', () => {
  // A New York player is in Vancouver. Their phone stamps samples with -07:00.
  it('a late-evening Vancouver walk belongs to the next New York day', () => {
    const sample = '2027-01-10T22:30:00-07:00'; // 12:30 AM Jan 11 in New York
    expect(localDateOf(sample, NY)).toBe('2027-01-11');
    // Not the phone's local date.
    expect(localDateOf(sample, VANCOUVER)).toBe('2027-01-10');
  });

  it('a Halifax player in Kolkata still plays the Halifax day', () => {
    const sample = '2027-01-10T09:00:00+05:30'; // 11:30 PM Jan 9 in Halifax
    expect(localDateOf(sample, HALIFAX)).toBe('2027-01-09');
  });

  it('the same instant gives the same answer whatever offset the phone used', () => {
    const a = '2027-01-11T03:30:00Z';
    const b = '2027-01-10T22:30:00-05:00';
    const c = '2027-01-10T19:30:00-08:00';
    const d = '2027-01-11T09:00:00+05:30';
    const dates = [a, b, c, d].map((s) => localDateOf(s, HALIFAX));
    expect(new Set(dates)).toEqual(new Set(['2027-01-10']));
  });

  it('a travelling player is locked by home noon, not phone noon', () => {
    // NY player in Vancouver: Jan 10 locks at 12:00 PM ET = 10:00 AM Vancouver on Jan 11.
    const now = DateTime.fromISO('2027-01-11T10:00:00-07:00');
    expect(isLocked('2027-01-10', NY, now)).toBe(true);
    expect(isLocked('2027-01-10', NY, now.minus({ milliseconds: 1 }))).toBe(false);
  });

  it('splitting uses the home zone even when the phone sent another offset', () => {
    // 11:50 PM – 12:10 AM in New York, sent from a phone in Vancouver.
    const parts = splitIntervalByLocalDay(
      '2027-01-10T21:50:00-07:00',
      '2027-01-10T22:10:00-07:00',
      NY,
    );
    expect(parts.map((p) => [p.localDate, minutesOf(p)])).toEqual([
      ['2027-01-10', 10],
      ['2027-01-11', 10],
    ]);
  });
});

describe('lockInstant and isLocked', () => {
  it('locks at 12:00 PM the next local day', () => {
    expect(iso(lockInstant('2027-01-10', NY))).toBe('2027-01-11T17:00:00.000Z');
    expect(iso(lockInstant('2027-01-10', HALIFAX))).toBe('2027-01-11T16:00:00.000Z');
    expect(iso(lockInstant('2027-01-10', VANCOUVER))).toBe('2027-01-11T19:00:00.000Z');
    expect(iso(lockInstant('2027-01-10', KOLKATA))).toBe('2027-01-11T06:30:00.000Z');
  });

  it('handles month and year ends', () => {
    expect(iso(lockInstant('2027-01-31', NY))).toBe('2027-02-01T17:00:00.000Z');
    expect(iso(lockInstant('2027-12-31', NY))).toBe('2028-01-01T17:00:00.000Z');
    expect(iso(lockInstant('2028-02-28', NY))).toBe('2028-02-29T17:00:00.000Z');
  });

  it.each([NY, HALIFAX, VANCOUVER, KOLKATA])('in %s: open before noon, locked at noon', (zone) => {
    const lock = lockInstant('2027-01-10', zone);
    expect(isLocked('2027-01-10', zone, lock.minus({ milliseconds: 1 }))).toBe(false);
    expect(isLocked('2027-01-10', zone, lock)).toBe(true);
    expect(isLocked('2027-01-10', zone, lock.plus({ days: 30 }))).toBe(true);
    // During the day itself and the finalizing window it is open.
    const { start, end } = dayWindow('2027-01-10', zone);
    expect(isLocked('2027-01-10', zone, start)).toBe(false);
    expect(isLocked('2027-01-10', zone, end)).toBe(false);
  });

  it('accepts ISO strings for now', () => {
    expect(isLocked('2027-01-10', NY, '2027-01-11T12:00:00-05:00')).toBe(true);
    expect(isLocked('2027-01-10', NY, '2027-01-11T11:59:59-05:00')).toBe(false);
  });
});

describe('splitIntervalByLocalDay', () => {
  it('keeps an interval inside one day whole', () => {
    const parts = splitIntervalByLocalDay('2027-01-10T15:00:00Z', '2027-01-10T15:20:00Z', NY);
    expect(parts.map((p) => [p.localDate, iso(p.start), iso(p.end)])).toEqual([
      ['2027-01-10', '2027-01-10T15:00:00.000Z', '2027-01-10T15:20:00.000Z'],
    ]);
  });

  it('splits at New York midnight', () => {
    const parts = splitIntervalByLocalDay('2027-01-11T04:50:00Z', '2027-01-11T05:10:00Z', NY);
    expect(parts.map((p) => [p.localDate, iso(p.start), iso(p.end), minutesOf(p)])).toEqual([
      ['2027-01-10', '2027-01-11T04:50:00.000Z', '2027-01-11T05:00:00.000Z', 10],
      ['2027-01-11', '2027-01-11T05:00:00.000Z', '2027-01-11T05:10:00.000Z', 10],
    ]);
  });

  it('splits at Halifax and Vancouver midnight', () => {
    expect(
      splitIntervalByLocalDay('2027-01-11T03:45:00Z', '2027-01-11T04:15:00Z', HALIFAX).map((p) => [
        p.localDate,
        minutesOf(p),
      ]),
    ).toEqual([
      ['2027-01-10', 15],
      ['2027-01-11', 15],
    ]);
    expect(
      splitIntervalByLocalDay('2027-01-11T06:58:00Z', '2027-01-11T07:01:00Z', VANCOUVER).map(
        (p) => [p.localDate, minutesOf(p)],
      ),
    ).toEqual([
      ['2027-01-10', 2],
      ['2027-01-11', 1],
    ]);
  });

  it('splits at a half-hour zone midnight (Kolkata, UTC+5:30)', () => {
    // 18:00Z–19:00Z is 11:30 PM – 12:30 AM in Kolkata, but one hour inside a UTC day.
    const parts = splitIntervalByLocalDay('2027-01-10T18:00:00Z', '2027-01-10T19:00:00Z', KOLKATA);
    expect(parts.map((p) => [p.localDate, iso(p.start), iso(p.end), minutesOf(p)])).toEqual([
      ['2027-01-10', '2027-01-10T18:00:00.000Z', '2027-01-10T18:30:00.000Z', 30],
      ['2027-01-11', '2027-01-10T18:30:00.000Z', '2027-01-10T19:00:00.000Z', 30],
    ]);
  });

  it('covers several days, with whole days in the middle', () => {
    const parts = splitIntervalByLocalDay(
      '2027-01-10T22:00:00-05:00',
      '2027-01-13T01:00:00-05:00',
      NY,
    );
    expect(parts.map((p) => [p.localDate, minutesOf(p)])).toEqual([
      ['2027-01-10', 120],
      ['2027-01-11', 1440],
      ['2027-01-12', 1440],
      ['2027-01-13', 60],
    ]);
  });

  it('a whole DST day splits into 23 and 25 hours', () => {
    const spring = dayWindow('2027-03-14', NY);
    const fall = dayWindow('2027-11-07', NY);
    expect(splitIntervalByLocalDay(spring.start, spring.end, NY).map(minutesOf)).toEqual([23 * 60]);
    expect(splitIntervalByLocalDay(fall.start, fall.end, NY).map(minutesOf)).toEqual([25 * 60]);
  });

  it('an interval across the fall-back night stays in one day', () => {
    // 12:30 AM – 3:30 AM local on Nov 7 is 4 real hours.
    const parts = splitIntervalByLocalDay('2027-11-07T04:30:00Z', '2027-11-07T08:30:00Z', NY);
    expect(parts.map((p) => [p.localDate, minutesOf(p)])).toEqual([['2027-11-07', 240]]);
  });

  it('pieces add back up to the original length', () => {
    const start = '2027-03-13T21:17:00-05:00';
    const end = '2027-03-16T02:43:00-04:00';
    const total = minutesOf({ start: DateTime.fromISO(start), end: DateTime.fromISO(end) });
    for (const zone of [NY, HALIFAX, VANCOUVER, KOLKATA]) {
      const sum = splitIntervalByLocalDay(start, end, zone)
        .map(minutesOf)
        .reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
    }
  });

  it('returns nothing for an empty interval', () => {
    expect(splitIntervalByLocalDay('2027-01-10T15:00:00Z', '2027-01-10T15:00:00Z', NY)).toEqual([]);
  });

  it('rejects an interval that ends before it starts', () => {
    expect(() =>
      splitIntervalByLocalDay('2027-01-10T15:00:00Z', '2027-01-10T14:59:00Z', NY),
    ).toThrow(RangeError);
  });
});

describe('minutesOf', () => {
  it('counts real elapsed minutes, including fractions', () => {
    expect(
      minutesOf({ start: utc('2027-01-10T15:00:00Z'), end: utc('2027-01-10T15:01:30Z') }),
    ).toBe(1.5);
    expect(
      minutesOf({ start: utc('2027-01-10T15:00:00Z'), end: utc('2027-01-10T15:00:00Z') }),
    ).toBe(0);
  });

  it('accepts a Luxon Interval', () => {
    const interval = Interval.fromDateTimes(
      utc('2027-01-10T15:00:00Z'),
      utc('2027-01-10T17:00:00Z'),
    );
    expect(minutesOf(interval)).toBe(120);
  });

  it('rejects a negative or invalid interval', () => {
    expect(() =>
      minutesOf({ start: utc('2027-01-10T15:00:00Z'), end: utc('2027-01-10T14:00:00Z') }),
    ).toThrow(RangeError);
    expect(() => minutesOf(Interval.invalid('test'))).toThrow(RangeError);
  });
});
