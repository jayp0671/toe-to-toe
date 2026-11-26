/**
 * POST /functions/v1/sync (docs/PLAN.md §12.2, Appendix A5).
 *
 * Order of checks:
 *   405 not POST · 401 unknown key · 429 synced < 30 s ago · 413 body > 1 MB · 422 not JSON ·
 *   426 old Shortcut · 413 > 5,000 items in a metric · 422 schema (names the field) · 200.
 *
 * All time checks use app_now() from the database (golden rule 2), read once per request through
 * sync_auth and used as this request's clock. The decisions (what is ignored, de-duplication, day
 * totals, status) are made by the pure engine; this file only does I/O. Writes go through
 * sync_apply in one transaction, which re-checks the lock and the 30-second limit.
 */
import {
  dailyTotals,
  dayStatus,
  dayWindow,
  describeIssue,
  formatPoints,
  isLocked,
  isOutdatedShortcut,
  mergeHours,
  oversizedMetric,
  planSync,
  screenSync,
  sourcesByDate,
  stubPointsHundredths,
  SYNC_LIMITS,
  SyncBodySchema,
  toInstant,
  type Clock,
  type LocalDate,
} from '../../../packages/engine/src/index.ts';
import type { Db } from '../_shared/db.ts';
import { bearerToken, fail, json, readTextLimited, sha256Hex } from '../_shared/http.ts';

export interface SyncDeps {
  db: Db;
  /** Where an outdated Shortcut gets the new version (426). */
  shortcutUrl: string;
}

interface SyncDay {
  date: LocalDate;
  steps: number;
  points: number;
  status: 'live' | 'finalizing';
}

/** Day statuses that close a day to new data before (or after) its noon lock. */
const CLOSED_STATUSES = new Set(['locked', 'review', 'voided']);

/** Points as a JSON number with two decimals, from integer hundredths (golden rule 1). */
const pointsOf = (hundredths: number): number => Number(formatPoints(hundredths));

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createSyncHandler({
  db,
  shortcutUrl,
}: SyncDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

    // ---------------------------------------------------------------- auth + rate limit
    const key = bearerToken(req);
    if (!key)
      return fail(401, 'unauthorized', 'Missing sync key. Send Authorization: Bearer <sync key>.');
    const auth = await db.rpc('sync_auth', { p_key_hash: await sha256Hex(key) });
    throwIf(auth.error);
    const who = auth.data?.[0];
    if (!who)
      return fail(
        401,
        'unauthorized',
        'Unknown or rotated sync key. Copy your key again from Profile → Sync setup.',
      );
    if (who.rate_limited) return rateLimited();

    const clock: Clock = { now: () => toInstant(who.server_now) };
    const now = clock.now();
    const homeTz = who.home_tz;

    // ---------------------------------------------------------------- body
    const text = await readTextLimited(req, SYNC_LIMITS.maxBodyBytes);
    if (text === undefined) return fail(413, 'payload_too_large', 'Body is over 1 MB.');
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return fail(422, 'invalid_payload', 'body: not valid JSON');
    }
    if (isOutdatedShortcut(raw)) {
      return fail(
        426,
        'shortcut_outdated',
        `Your Toe to Toe Sync Shortcut is too old. Get the new version: ${shortcutUrl}`,
      );
    }
    const big = oversizedMetric(raw);
    if (big) {
      return fail(
        413,
        'payload_too_large',
        `metrics.${big}: more than ${SYNC_LIMITS.maxSamplesPerMetric} samples.`,
      );
    }
    const parsed = SyncBodySchema.safeParse(raw);
    if (!parsed.success) return fail(422, 'invalid_payload', describeIssue(parsed.error));

    // ---------------------------------------------------------------- plan
    const screened = screenSync(parsed.data, homeTz, now);
    const closed = new Set<LocalDate>();
    const first = screened.dates[0];
    const last = screened.dates.at(-1);
    if (first && last) {
      const stats = await db
        .from('daily_stats')
        .select('local_date, status')
        .eq('user_id', who.user_id)
        .gte('local_date', first)
        .lte('local_date', last);
      throwIf(stats.error);
      for (const row of stats.data ?? [])
        if (CLOSED_STATUSES.has(row.status)) closed.add(row.local_date);
    }
    const isDateLocked = (date: LocalDate) => closed.has(date) || isLocked(date, homeTz, now);
    const plan = planSync(screened, isDateLocked);

    // ---------------------------------------------------------------- day totals from all stored hours
    let days: {
      localDate: LocalDate;
      steps: number;
      flights: number;
      distance_m: number;
      sources: string[];
      status: SyncDay['status'];
    }[] = [];
    const dFirst = plan.dates[0];
    const dLast = plan.dates.at(-1);
    if (dFirst && dLast) {
      const from = dayWindow(dFirst, homeTz).start.toISO();
      const to = dayWindow(dLast, homeTz).end.toISO();
      const [storedHours, storedSources] = await Promise.all([
        db
          .from('hours')
          .select('hour_start_utc, steps, flights, distance_m')
          .eq('user_id', who.user_id)
          .gte('hour_start_utc', from)
          .lt('hour_start_utc', to),
        db
          .from('source_hours')
          .select('hour_start_utc, source_name')
          .eq('user_id', who.user_id)
          .gte('hour_start_utc', from)
          .lt('hour_start_utc', to),
      ]);
      throwIf(storedHours.error);
      throwIf(storedSources.error);
      const merged = mergeHours(
        (storedHours.data ?? []).map((h) => ({ ...h, hourStartUtc: h.hour_start_utc })),
        plan.hours,
      );
      const sources = sourcesByDate(
        [
          ...(storedSources.data ?? []).map((h) => ({
            hourStartUtc: h.hour_start_utc,
            sourceName: h.source_name,
          })),
          ...plan.sourceHours,
        ],
        homeTz,
      );
      const wanted = new Set(plan.dates);
      days = dailyTotals(merged, homeTz)
        .filter((d) => wanted.has(d.localDate))
        .map((d) => ({
          ...d,
          sources: sources.get(d.localDate) ?? [],
          status: dayStatus(d.localDate, homeTz, now),
        }));
    }

    // ---------------------------------------------------------------- write
    const applied = await db.rpc('sync_apply', {
      p_user_id: who.user_id,
      p_home_tz: homeTz,
      p_days: days.map((d) => ({
        local_date: d.localDate,
        steps: d.steps,
        flights: d.flights,
        distance_m: d.distance_m,
        sources: d.sources,
        status: d.status,
      })),
      p_hours: plan.hours.map((h) => ({
        hour_start_utc: h.hourStartUtc,
        local_date: h.localDate,
        steps: h.steps,
        flights: h.flights,
        distance_m: h.distance_m,
      })),
      p_source_hours: plan.sourceHours.map((h) => ({
        hour_start_utc: h.hourStartUtc,
        local_date: h.localDate,
        source_name: h.sourceName,
        steps: h.steps,
        flights: h.flights,
        distance_m: h.distance_m,
      })),
    });
    throwIf(applied.error);
    const result = applied.data as { rate_limited: boolean; dates?: LocalDate[] } | null;
    if (!result || result.rate_limited) return rateLimited();
    // A date the lock job closed between planning and writing is not reported as updated.
    const written = new Set(result.dates ?? []);

    const body: { ok: true; home_tz: string; ignored: typeof plan.ignored; days: SyncDay[] } = {
      ok: true,
      home_tz: homeTz,
      ignored: plan.ignored,
      days: days
        .filter((d) => written.has(d.localDate))
        .sort((a, b) => (a.localDate < b.localDate ? 1 : -1))
        .map((d) => ({
          date: d.localDate,
          steps: d.steps,
          points: pointsOf(stubPointsHundredths(d.steps)),
          status: d.status,
        })),
    };
    return json(200, body);
  };
}

function rateLimited(): Response {
  return fail(
    429,
    'rate_limited',
    `One sync per ${SYNC_LIMITS.minSecondsBetweenSyncs} seconds. Try again shortly.`,
  );
}
