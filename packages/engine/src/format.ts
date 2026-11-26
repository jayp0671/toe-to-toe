/**
 * Format a score stored as integer hundredths for display (CLAUDE.md golden rule 1).
 * formatPoints(10843) === "108.43". Negative scores are allowed.
 */
export function formatPoints(hundredths: number): string {
  if (!Number.isSafeInteger(hundredths)) {
    throw new RangeError(`Points must be an integer number of hundredths, got ${hundredths}`);
  }
  const sign = hundredths < 0 ? '-' : '';
  const abs = Math.abs(hundredths);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${sign}${whole}.${cents.toString().padStart(2, '0')}`;
}
