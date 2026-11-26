/**
 * /sync function tests (docs/PLAN.md Appendix A3 layer 6, A5). They run the real handler against the
 * local database on a fake clock (app_config test mode).
 */
import { assert, assertEquals, assertMatch } from '../_shared/asserts.ts';
import {
  clearFakeNow,
  createTestUser,
  fixture,
  setFakeNow,
  snapshot,
  testDb,
  type TestUser,
} from '../_shared/test_support.ts';
import { createSyncHandler } from './handler.ts';

const SHORTCUT_URL = 'https://example.test/toe-to-toe-sync';
/** 9:00 AM ET Jan 11 2027: Jan 9 is locked, Jan 10 is finalizing, Jan 11 is live. */
const NINE_AM_JAN_11 = '2027-01-11T14:00:00Z';

const db = await testDb();
const handler = createSyncHandler({ db, shortcutUrl: SHORTCUT_URL });

function post(
  key: string | undefined,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
  return handler(new Request('http://localhost/sync', init));
}

/** Run a test with a fresh user on the fake clock, then clean up. */
function syncTest(name: string, fn: (user: TestUser) => Promise<void>): void {
  Deno.test(name, async () => {
    await setFakeNow(db, NINE_AM_JAN_11);
    const user = await createTestUser(db);
    try {
      await fn(user);
    } finally {
      await user.remove();
      await clearFakeNow(db);
    }
  });
}

const samples = (steps: unknown[], extra: Record<string, unknown> = {}) => ({
  v: 1,
  kind: 'samples',
  sent_at: '2027-01-11T09:00:00-05:00',
  device_tz: 'America/New_York',
  shortcut_version: '1.0',
  metrics: { steps },
  ...extra,
});
const step = (s: string, e: string, n: number, src = "Jay's iPhone") => ({ s, e, n, src });

async function errorOf(res: Response): Promise<{ error: string; message: string }> {
  const body = (await res.json()) as { ok: boolean; error: string; message: string };
  assertEquals(body.ok, false);
  return body;
}

// ---------------------------------------------------------------- good sync
syncTest('good sync: 200 with the A5 body, rows written, last_used_at set', async (user) => {
  const res = await post(user.key, await fixture('watch-and-phone-same-walk.json'));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    ok: true,
    home_tz: 'America/New_York',
    ignored: { locked_days: 0, outside_window: 0, manual: 0 },
    days: [{ date: '2027-01-10', steps: 2000, points: 20, status: 'finalizing' }],
  });

  const hours = await db
    .from('hours')
    .select('hour_start_utc, steps, flights, distance_m')
    .eq('user_id', user.id)
    .order('hour_start_utc');
  assertEquals(hours.data, [
    { hour_start_utc: '2027-01-10T13:00:00+00:00', steps: 1700, flights: 3, distance_m: 1021 },
    { hour_start_utc: '2027-01-10T17:00:00+00:00', steps: 300, flights: 0, distance_m: 0 },
  ]);
  const sources = await db.from('source_hours').select('source_name').eq('user_id', user.id);
  assertEquals(sources.data?.length, 3);
  const day = await db
    .from('daily_stats')
    .select('local_date, home_tz, steps, flights, distance_m, sources, status')
    .eq('user_id', user.id)
    .single();
  assertEquals(day.data, {
    local_date: '2027-01-10',
    home_tz: 'America/New_York',
    steps: 2000,
    flights: 3,
    distance_m: 1021,
    sources: ["Jay's Apple Watch", "Jay's iPhone"],
    status: 'finalizing',
  });
  const key = await db.from('sync_keys').select('last_used_at').eq('user_id', user.id).single();
  assertEquals(key.data?.last_used_at, '2027-01-11T14:00:00+00:00');
});

syncTest('accepted syncs are logged in sync_log; 429 and 401 are not (P0.8)', async (user) => {
  assertEquals((await post(user.key, await fixture('watch-and-phone-same-walk.json'))).status, 200);
  assertEquals((await post(user.key, await fixture('watch-and-phone-same-walk.json'))).status, 429);
  assertEquals((await post('not-a-key', samples([]))).status, 401);
  const log = await db.from('sync_log').select('synced_at, dates').eq('user_id', user.id);
  assertEquals(log.data, [{ synced_at: '2027-01-11T14:00:00+00:00', dates: ['2027-01-10'] }]);
});

syncTest(
  'days list newest first with live and finalizing, points are steps x 0.01',
  async (user) => {
    const res = await post(
      user.key,
      samples([
        step('2027-01-10T08:00:00-05:00', '2027-01-10T08:10:00-05:00', 8547),
        step('2027-01-11T08:00:00-05:00', '2027-01-11T08:10:00-05:00', 10431),
      ]),
    );
    assertEquals(res.status, 200);
    const body = (await res.json()) as { days: unknown[] };
    assertEquals(body.days, [
      { date: '2027-01-11', steps: 10431, points: 104.31, status: 'live' },
      { date: '2027-01-10', steps: 8547, points: 85.47, status: 'finalizing' },
    ]);
  },
);

syncTest('a later sync adds to the stored hours of the day', async (user) => {
  await post(
    user.key,
    samples([step('2027-01-11T07:00:00-05:00', '2027-01-11T07:10:00-05:00', 100)]),
  );
  await setFakeNow(db, '2027-01-11T15:00:00Z');
  // The Shortcut re-sends the whole day; here the second payload only has the new hour.
  const res = await post(
    user.key,
    samples([step('2027-01-11T09:00:00-05:00', '2027-01-11T09:10:00-05:00', 250)]),
  );
  assertEquals(res.status, 200);
  const body = (await res.json()) as { days: { steps: number }[] };
  assertEquals(body.days[0]?.steps, 350);
});

// ---------------------------------------------------------------- idempotency
syncTest('an identical payload sent twice changes nothing', async (user) => {
  const payload = await fixture('watch-and-phone-same-walk.json');
  const first = await post(user.key, payload);
  assertEquals(first.status, 200);
  const firstBody = await first.json();
  const before = await snapshot(db, user.id);

  await setFakeNow(db, '2027-01-11T14:00:31Z'); // past the 30-second limit
  const second = await post(user.key, payload);
  assertEquals(second.status, 200);
  assertEquals(await second.json(), firstBody);
  assertEquals(await snapshot(db, user.id), before);
});

// ---------------------------------------------------------------- ignored data
syncTest('late data for a locked day is ignored', async (user) => {
  // 11:00 AM ET Jan 11: Jan 10 is still open.
  await setFakeNow(db, '2027-01-11T16:00:00Z');
  const open = await post(
    user.key,
    samples([step('2027-01-10T20:00:00-05:00', '2027-01-10T20:10:00-05:00', 500)]),
  );
  assertEquals(open.status, 200);
  const before = await snapshot(db, user.id);

  // 12:00 PM ET Jan 11: Jan 10 has locked. A late sample for Jan 10 must not count anywhere.
  await setFakeNow(db, '2027-01-11T17:00:00Z');
  const late = await post(
    user.key,
    samples([
      step('2027-01-10T20:00:00-05:00', '2027-01-10T20:10:00-05:00', 500),
      step('2027-01-10T21:00:00-05:00', '2027-01-10T21:10:00-05:00', 9000),
    ]),
  );
  assertEquals(late.status, 200);
  assertEquals(await late.json(), {
    ok: true,
    home_tz: 'America/New_York',
    ignored: { locked_days: 2, outside_window: 0, manual: 0 },
    days: [],
  });
  assertEquals(await snapshot(db, user.id), before);
});

syncTest('a day locked by status (under review) is ignored before noon too', async (user) => {
  await post(
    user.key,
    samples([step('2027-01-10T20:00:00-05:00', '2027-01-10T20:10:00-05:00', 500)]),
  );
  const review = await db.from('daily_stats').update({ status: 'review' }).eq('user_id', user.id);
  assert(!review.error);
  await setFakeNow(db, '2027-01-11T14:01:00Z');
  const res = await post(
    user.key,
    samples([step('2027-01-10T21:00:00-05:00', '2027-01-10T21:10:00-05:00', 9000)]),
  );
  const body = (await res.json()) as { ignored: { locked_days: number }; days: unknown[] };
  assertEquals(body.ignored.locked_days, 1);
  assertEquals(body.days, []);
  const day = await db.from('daily_stats').select('steps').eq('user_id', user.id).single();
  assertEquals(day.data?.steps, 500);
});

syncTest('samples older than 48 hours are ignored', async (user) => {
  const res = await post(
    user.key,
    samples([step('2027-01-08T08:00:00-05:00', '2027-01-08T08:10:00-05:00', 700)]),
  );
  const body = (await res.json()) as { ignored: unknown; days: unknown[] };
  assertEquals(body.ignored, { locked_days: 0, outside_window: 1, manual: 0 });
  assertEquals(body.days, []);
});

syncTest('a manual entry (Health app source) is ignored', async (user) => {
  const res = await post(user.key, await fixture('manual-entry.json'));
  assertEquals(res.status, 200);
  const body = (await res.json()) as { ignored: { manual: number }; days: { steps: number }[] };
  assertEquals(body.ignored.manual, 3);
  assertEquals(
    body.days.map((d) => d.steps),
    [2000],
  );
  const sources = await db.from('source_hours').select('source_name').eq('user_id', user.id);
  assert(!(sources.data ?? []).some((r) => r.source_name === 'Health'));
});

// ---------------------------------------------------------------- error codes
syncTest('401: missing, malformed or unknown sync key', async (user) => {
  const body = samples([]);
  for (const res of [
    await post(undefined, body),
    await post(undefined, body, { Authorization: user.key }),
    await post('not-a-real-key', body),
  ]) {
    assertEquals(res.status, 401);
    assertEquals((await errorOf(res)).error, 'unauthorized');
  }
});

syncTest('401: a rotated key stops working', async (user) => {
  const { error } = await db.rpc('sync_key_rotate', {
    p_user_id: user.id,
    p_key_hash: 'f'.repeat(64),
  });
  assert(!error);
  const res = await post(user.key, samples([]));
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

syncTest('413: body over 1 MB', async (user) => {
  const big = JSON.stringify(samples([], { padding: 'x'.repeat(1_048_577) }));
  const res = await post(user.key, big);
  assertEquals(res.status, 413);
  assertEquals((await errorOf(res)).error, 'payload_too_large');
});

syncTest('413: more than 5,000 samples in one metric', async (user) => {
  const one = step('2027-01-11T08:00:00-05:00', '2027-01-11T08:00:01-05:00', 1);
  const ok = await post(user.key, samples(Array.from({ length: 5000 }, () => one)));
  assertEquals(ok.status, 200);
  await ok.body?.cancel();
  await setFakeNow(db, '2027-01-11T14:01:00Z');
  const res = await post(user.key, samples(Array.from({ length: 5001 }, () => one)));
  assertEquals(res.status, 413);
  assertMatch((await errorOf(res)).message, /steps/);
});

syncTest('422: malformed payloads name the field', async (user) => {
  const cases: [unknown, RegExp][] = [
    ['{not json', /^body: /],
    [
      samples([step('2027-01-11T08:00:00-05:00', '2027-01-11T08:10:00-05:00', 1.5)]),
      /^metrics\.steps\[0\]\.n: /,
    ],
    [
      samples([step('2027-01-11T08:00:00', '2027-01-11T08:10:00-05:00', 1)]),
      /^metrics\.steps\[0\]\.s: /,
    ],
    [{ ...samples([]), kind: 'minutes' }, /^kind: /],
    [{ ...samples([]), v: undefined }, /^v: /],
  ];
  for (const [body, message] of cases) {
    const res = await post(user.key, body);
    assertEquals(res.status, 422);
    const err = await errorOf(res);
    assertEquals(err.error, 'invalid_payload');
    assertMatch(err.message, message);
  }
  // Rejected payloads do not use up the 30-second slot.
  const good = await post(user.key, samples([]));
  assertEquals(good.status, 200);
  await good.body?.cancel();
});

syncTest('426: an old Shortcut version gets the update link', async (user) => {
  const res = await post(user.key, samples([], { shortcut_version: '0.9' }));
  assertEquals(res.status, 426);
  const err = await errorOf(res);
  assertEquals(err.error, 'shortcut_outdated');
  assertMatch(err.message, new RegExp(SHORTCUT_URL.replace(/[./]/g, '\\$&')));
});

syncTest('429: more than one sync per 30 seconds', async (user) => {
  const first = await post(user.key, samples([]));
  assertEquals(first.status, 200);
  await first.body?.cancel();
  await setFakeNow(db, '2027-01-11T14:00:29Z');
  const second = await post(user.key, samples([]));
  assertEquals(second.status, 429);
  assertEquals((await errorOf(second)).error, 'rate_limited');
  await setFakeNow(db, '2027-01-11T14:00:30Z');
  const third = await post(user.key, samples([]));
  assertEquals(third.status, 200);
  await third.body?.cancel();
});

syncTest('405: only POST', async (user) => {
  const res = await handler(
    new Request('http://localhost/sync', { headers: { Authorization: `Bearer ${user.key}` } }),
  );
  assertEquals(res.status, 405);
  await res.body?.cancel();
});
