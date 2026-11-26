/** /api function tests (docs/PLAN.md Appendix A6, A9): POST /api/sync-key/rotate. */
import { assert, assertEquals, assertMatch } from '../_shared/asserts.ts';
import { sha256Hex } from '../_shared/http.ts';
import {
  clearFakeNow,
  createTestUser,
  setFakeNow,
  testDb,
  type TestUser,
} from '../_shared/test_support.ts';
import { createSyncHandler } from '../sync/handler.ts';
import { createApiHandler } from './handler.ts';

const db = await testDb();
const api = createApiHandler({ db });
const sync = createSyncHandler({ db, shortcutUrl: 'https://example.test/shortcut' });

function rotate(token: string | undefined, method = 'POST'): Promise<Response> {
  return api(
    new Request('http://localhost/api/sync-key/rotate', {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  );
}

function syncWith(key: string): Promise<Response> {
  return sync(
    new Request('http://localhost/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        v: 1,
        kind: 'samples',
        sent_at: '2027-01-11T09:00:00-05:00',
        device_tz: 'America/New_York',
        shortcut_version: '1.0',
        metrics: {},
      }),
    }),
  );
}

function apiTest(name: string, fn: (user: TestUser) => Promise<void>): void {
  Deno.test(name, async () => {
    await setFakeNow(db, '2027-01-11T14:00:00Z');
    const user = await createTestUser(db);
    try {
      await fn(user);
    } finally {
      await user.remove();
      await clearFakeNow(db);
    }
  });
}

apiTest('rotate returns a new 32-byte key once and stores only its hash', async (user) => {
  const res = await rotate(await user.accessToken());
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Cache-Control'), 'no-store');
  const body = (await res.json()) as { ok: boolean; key: string };
  assertEquals(body.ok, true);
  // 32 random bytes, base64url without padding.
  assertMatch(body.key, /^[A-Za-z0-9_-]{43}$/);

  const row = await db
    .from('sync_keys')
    .select('key_hash, created_at, last_used_at')
    .eq('user_id', user.id)
    .single();
  assertEquals(row.data, {
    key_hash: await sha256Hex(body.key),
    created_at: '2027-01-11T14:00:00+00:00',
    last_used_at: null,
  });
  const audit = await db.from('audit_log').select('action, after').eq('actor', user.id);
  assertEquals(audit.data, [{ action: 'sync_key.rotate', after: null }]);
});

apiTest('the old key stops working and the new key syncs', async (user) => {
  const res = await rotate(await user.accessToken());
  const { key } = (await res.json()) as { key: string };
  const old = await syncWith(user.key);
  assertEquals(old.status, 401);
  await old.body?.cancel();
  const fresh = await syncWith(key);
  assertEquals(fresh.status, 200);
  await fresh.body?.cancel();
});

apiTest('each rotation gives a different key', async (user) => {
  const token = await user.accessToken();
  const a = ((await (await rotate(token)).json()) as { key: string }).key;
  const b = ((await (await rotate(token)).json()) as { key: string }).key;
  assert(a !== b, 'keys must differ');
});

apiTest('401 without a signed-in user', async (user) => {
  for (const token of [undefined, 'not-a-jwt', user.key]) {
    const res = await rotate(token);
    assertEquals(res.status, 401);
    await res.body?.cancel();
  }
  const row = await db.from('sync_keys').select('key_hash').eq('user_id', user.id).single();
  assertEquals(row.data?.key_hash, await sha256Hex(user.key));
});

apiTest('405 for GET, 404 for an unknown route', async (user) => {
  const token = await user.accessToken();
  const get = await rotate(token, 'GET');
  assertEquals(get.status, 405);
  await get.body?.cancel();
  const missing = await api(
    new Request('http://localhost/api/nope', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  assertEquals(missing.status, 404);
  await missing.body?.cancel();
});

// The web app (localhost in dev, Cloudflare Pages in staging) calls /api from the browser, so the
// preflight must pass and every response must carry the CORS headers. Auth is a bearer token, never
// a cookie, so any origin is safe.
Deno.test('OPTIONS preflight answers 204 with CORS headers and no auth', async () => {
  const res = await api(
    new Request('http://localhost/api/sync-key/rotate', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, apikey, content-type, x-client-info',
      },
    }),
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
  assertMatch(res.headers.get('Access-Control-Allow-Methods') ?? '', /\bPOST\b/);
  const allowed = (res.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase();
  for (const h of ['authorization', 'apikey', 'content-type', 'x-client-info']) {
    assert(allowed.includes(h), `Access-Control-Allow-Headers must include ${h}`);
  }
  await res.body?.cancel();
});

apiTest('responses carry CORS headers (200, 401 and 404)', async (user) => {
  const ok = await rotate(await user.accessToken());
  assertEquals(ok.status, 200);
  assertEquals(ok.headers.get('Access-Control-Allow-Origin'), '*');
  await ok.body?.cancel();
  const unauthorized = await rotate(undefined);
  assertEquals(unauthorized.status, 401);
  assertEquals(unauthorized.headers.get('Access-Control-Allow-Origin'), '*');
  await unauthorized.body?.cancel();
  const missing = await api(new Request('http://localhost/api/nope', { method: 'POST' }));
  assertEquals(missing.status, 404);
  assertEquals(missing.headers.get('Access-Control-Allow-Origin'), '*');
  await missing.body?.cancel();
});
