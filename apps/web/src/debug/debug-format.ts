/** Pure helpers for the /debug page (P0.7). */

/** The /sync per-item bound, also enforced by phase0_checks.health_steps. */
export const MAX_HEALTH_STEPS = 1_000_000;

export type ParsedSteps = { ok: true; steps: number } | { ok: false; message: string };

/** "10,250" or "10250" → 10250. Whole numbers from 0 to 1,000,000 only. */
export function parseHealthSteps(text: string): ParsedSteps {
  const cleaned = text.trim().replace(/[,\s]/g, '');
  if (cleaned === '') return { ok: false, message: 'Type the number the Health app shows.' };
  if (!/^\d+$/.test(cleaned)) return { ok: false, message: 'Whole steps only, like 10250.' };
  const steps = Number(cleaned);
  if (steps > MAX_HEALTH_STEPS) return { ok: false, message: 'That is more than 1,000,000 steps.' };
  return { ok: true, steps };
}

/** A sync instant shown in the player's home zone, e.g. "Jan 11, 9:42 AM EST". */
export function formatSyncTime(iso: string | null, timeZone: string): string {
  if (!iso) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

/** Steps with thousands separators. */
export function formatSteps(steps: number): string {
  return new Intl.NumberFormat('en-US').format(steps);
}

/** A 6-digit email code, ignoring spaces the mail app may add. Undefined when it isn't 6 digits. */
export function cleanOtpCode(text: string): string | undefined {
  const digits = text.replace(/\s/g, '');
  return /^\d{6}$/.test(digits) ? digits : undefined;
}
