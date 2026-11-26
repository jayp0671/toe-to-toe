import { describe, expect, it } from 'vitest';
import { FakeClock, systemClock } from './clock.ts';

describe('systemClock', () => {
  it('returns a valid UTC instant', () => {
    const now = systemClock.now();
    expect(now.isValid).toBe(true);
    expect(now.zoneName).toBe('UTC');
  });
});

describe('FakeClock', () => {
  it('starts at the given instant, normalised to UTC', () => {
    const clock = new FakeClock('2027-01-10T12:00:00-05:00');
    expect(clock.now().toISO()).toBe('2027-01-10T17:00:00.000Z');
  });

  it('only moves when told to', () => {
    const clock = new FakeClock('2027-01-10T17:00:00Z');
    expect(clock.now().toISO()).toBe(clock.now().toISO());
  });

  it('set() jumps to a new instant', () => {
    const clock = new FakeClock('2027-01-10T17:00:00Z');
    clock.set('2027-02-01T05:00:00Z');
    expect(clock.now().toISO()).toBe('2027-02-01T05:00:00.000Z');
  });

  it('advance() moves forward by a duration', () => {
    const clock = new FakeClock('2027-01-10T17:00:00Z');
    clock.advance({ hours: 25, minutes: 30 });
    expect(clock.now().toISO()).toBe('2027-01-11T18:30:00.000Z');
    clock.advance({ milliseconds: 1 });
    expect(clock.now().toISO()).toBe('2027-01-11T18:30:00.001Z');
  });

  it('advance() across the spring-forward night is real elapsed time', () => {
    // 2027-03-14 01:30 ET (EST) + 1 h = 03:30 EDT.
    const clock = new FakeClock('2027-03-14T06:30:00Z');
    clock.advance({ hours: 1 });
    expect(clock.now().setZone('America/New_York').toISO()).toBe('2027-03-14T03:30:00.000-04:00');
  });

  it('rejects instants without an explicit offset', () => {
    expect(() => new FakeClock('2027-01-10T12:00:00')).toThrow(RangeError);
    const clock = new FakeClock('2027-01-10T12:00:00Z');
    expect(() => clock.set('not a date')).toThrow(RangeError);
  });

  it('rejects moving backwards', () => {
    const clock = new FakeClock('2027-01-10T12:00:00Z');
    expect(() => clock.advance({ minutes: -1 })).toThrow(RangeError);
  });
});
