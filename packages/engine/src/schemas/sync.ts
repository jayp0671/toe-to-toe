import { z } from 'zod';
import { toInstant } from '../time.ts';

/**
 * The /sync request body (docs/PLAN.md Appendix A5). Shared by the Edge Function and tests.
 * Unknown top-level keys are stripped (fixtures carry a `fixture` key).
 *
 * Size limits (413) and the Shortcut version (426) are checked before this schema, on the raw JSON,
 * so they get their own status codes. Everything else malformed is a 422 naming the field.
 */

/** Limits from A5. */
export const SYNC_LIMITS = {
  /** Body size: 1 MB (1,048,576 bytes). */
  maxBodyBytes: 1_048_576,
  /** Samples (or hour items) per metric. */
  maxSamplesPerMetric: 5_000,
  /** One sync per key per this many seconds. */
  minSecondsBetweenSyncs: 30,
  /** Samples that ended longer ago than this are ignored. */
  windowHours: 48,
} as const;

/** Oldest Shortcut version the server accepts (A10: "Toe to Toe Sync" v1). */
export const MIN_SHORTCUT_VERSION = '1.0';

/**
 * Sanity bound on one wire count. Not a game rule: it keeps a corrupt sample from overflowing the
 * integer columns (a whole day of real walking is far below this).
 */
export const MAX_COUNT_PER_ITEM = 1_000_000;

const VERSION = /^\d{1,4}(?:\.\d{1,4}){0,2}$/;

const instant = z.string().refine(
  (s) => {
    try {
      toInstant(s);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'must be an ISO 8601 date-time with an offset, like 2027-01-10T08:01:00-05:00' },
);

const source = z.string().min(1).max(200);

/** Steps and flights are whole counts; distance may be fractional metres (rounded later). */
const wholeCount = z.number().int().min(0).max(MAX_COUNT_PER_ITEM);
const metres = z.number().min(0).max(MAX_COUNT_PER_ITEM);

/** Milliseconds since the epoch, or NaN when the instant is invalid (reported on its own field). */
function millis(iso: string): number {
  try {
    return +toInstant(iso);
  } catch {
    return Number.NaN;
  }
}

const sample = (n: z.ZodNumber) =>
  z
    .object({ s: instant, e: instant, n, src: source })
    .refine((x) => !(millis(x.e) < millis(x.s)), { message: 'must not be before s', path: ['e'] });

const hourItem = (n: z.ZodNumber) => z.object({ h: instant, n, src: source });

const common = {
  v: z.literal(1),
  sent_at: instant,
  device_tz: z.string().min(1).max(64),
  shortcut_version: z.string().regex(VERSION, 'must look like 1.0'),
};

export const SyncBodySchema = z.discriminatedUnion('kind', [
  z.object({
    ...common,
    kind: z.literal('samples'),
    metrics: z.object({
      steps: z.array(sample(wholeCount)).optional(),
      flights: z.array(sample(wholeCount)).optional(),
      distance_m: z.array(sample(metres)).optional(),
    }),
  }),
  z.object({
    ...common,
    kind: z.literal('hours'),
    metrics: z.object({
      steps: z.array(hourItem(wholeCount)).optional(),
      flights: z.array(hourItem(wholeCount)).optional(),
      distance_m: z.array(hourItem(metres)).optional(),
    }),
  }),
]);

export type SyncBody = z.infer<typeof SyncBodySchema>;

/** Compare dotted numeric versions: negative when a < b. Missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** True when the raw body names a well-formed Shortcut version older than the minimum (426). */
export function isOutdatedShortcut(raw: unknown, min: string = MIN_SHORTCUT_VERSION): boolean {
  if (typeof raw !== 'object' || raw === null) return false;
  const version = (raw as Record<string, unknown>)['shortcut_version'];
  return typeof version === 'string' && VERSION.test(version) && compareVersions(version, min) < 0;
}

/** The first metric in the raw body with more items than the limit (413), if any. */
export function oversizedMetric(
  raw: unknown,
  max: number = SYNC_LIMITS.maxSamplesPerMetric,
): string | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const metrics = (raw as Record<string, unknown>)['metrics'];
  if (typeof metrics !== 'object' || metrics === null) return undefined;
  for (const name of ['steps', 'flights', 'distance_m']) {
    const list = (metrics as Record<string, unknown>)[name];
    if (Array.isArray(list) && list.length > max) return name;
  }
  return undefined;
}

/** "metrics.steps[3].n: Too small..." for the first issue, naming the field (422). */
export function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'body: invalid';
  let path = '';
  for (const part of issue.path) {
    if (typeof part === 'number') path += `[${part}]`;
    else path += path ? `.${String(part)}` : String(part);
  }
  return `${path || 'body'}: ${issue.message}`;
}
