import { describe, expect, it } from 'vitest';
import { cleanOtpCode, formatSteps, formatSyncTime, parseHealthSteps } from './debug-format.ts';

describe('parseHealthSteps', () => {
  it('accepts whole numbers with or without separators', () => {
    expect(parseHealthSteps('10250')).toEqual({ ok: true, steps: 10250 });
    expect(parseHealthSteps(' 10,250 ')).toEqual({ ok: true, steps: 10250 });
    expect(parseHealthSteps('0')).toEqual({ ok: true, steps: 0 });
    expect(parseHealthSteps('1,000,000')).toEqual({ ok: true, steps: 1_000_000 });
  });

  it('rejects empty, negative, decimal and oversized values', () => {
    for (const bad of ['', '   ', '-5', '10.5', 'abc', '1e4', '1000001']) {
      expect(parseHealthSteps(bad).ok, bad).toBe(false);
    }
  });
});

describe('formatSyncTime', () => {
  it('shows the instant in the home zone', () => {
    expect(formatSyncTime('2027-01-11T14:42:00Z', 'America/New_York')).toBe('Jan 11, 9:42 AM EST');
    expect(formatSyncTime('2027-01-11T14:42:00Z', 'America/Halifax')).toBe('Jan 11, 10:42 AM AST');
  });

  it('says Never when there was no sync', () => {
    expect(formatSyncTime(null, 'America/New_York')).toBe('Never');
  });
});

describe('formatSteps', () => {
  it('adds thousands separators', () => {
    expect(formatSteps(10250)).toBe('10,250');
    expect(formatSteps(0)).toBe('0');
  });
});

describe('cleanOtpCode', () => {
  it('accepts exactly six digits, ignoring spaces', () => {
    expect(cleanOtpCode('123456')).toBe('123456');
    expect(cleanOtpCode('123 456')).toBe('123456');
  });

  it('rejects anything else', () => {
    for (const bad of ['12345', '1234567', 'abcdef', '']) expect(cleanOtpCode(bad)).toBeUndefined();
  });
});
