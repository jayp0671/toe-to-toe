import { describe, expect, it } from 'vitest';
import { formatPoints } from './format';

describe('formatPoints', () => {
  it('shows two decimals', () => {
    expect(formatPoints(10843)).toBe('108.43');
    expect(formatPoints(10500)).toBe('105.00');
    expect(formatPoints(7)).toBe('0.07');
    expect(formatPoints(0)).toBe('0.00');
  });

  it('allows negative scores', () => {
    expect(formatPoints(-1000)).toBe('-10.00');
    expect(formatPoints(-5)).toBe('-0.05');
  });

  it('rejects non-integer hundredths', () => {
    expect(() => formatPoints(1.5)).toThrow(RangeError);
  });
});
