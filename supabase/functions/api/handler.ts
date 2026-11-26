/**
 * /functions/v1/api/* (docs/PLAN.md Appendix A6). Every route needs a signed-in user.
 *
 *   POST /api/sync-key/rotate  Issue a new sync key. The old one stops working.
 *                              Returns the plaintext key once; only its SHA-256 is stored (A9).
 */
import type { Db } from '../_shared/db.ts';
import { CORS_HEADERS, bearerToken, fail, json, sha256Hex, withCors } from '../_shared/http.ts';

export interface ApiDeps {
  db: Db;
}

type Route = (ctx: { db: Db; userId: string }) => Promise<Response>;

const ROUTES: Record<string, Partial<Record<string, Route>>> = {
  '/sync-key/rotate': { POST: rotateSyncKey },
};

/** The route part of the path: /functions/v1/api/sync-key/rotate and /api/sync-key/rotate both give /sync-key/rotate. */
function routeOf(url: string): string {
  const path = new URL(url).pathname.replace(/\/+$/, '');
  return path.replace(/^(?:\/functions\/v1)?\/api(?=\/|$)/, '') || '/';
}

export function createApiHandler({ db }: ApiDeps): (req: Request) => Promise<Response> {
  // The web app calls /api from the browser. Auth is a bearer token (never a cookie), so any
  // origin may call; the preflight needs no auth (the gateway lets OPTIONS through).
  const handle = async (req: Request): Promise<Response> => {
    const methods = ROUTES[routeOf(req.url)];
    if (!methods) return fail(404, 'not_found', 'No such endpoint.');
    const route = methods[req.method];
    if (!route) return fail(405, 'method_not_allowed', `Use ${Object.keys(methods).join(', ')}.`);

    const token = bearerToken(req);
    if (!token) return fail(401, 'unauthorized', 'Sign in first.');
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return fail(401, 'unauthorized', 'Sign in first.');

    return route({ db, userId: data.user.id });
  };
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    return withCors(await handle(req));
  };
}

/** 32 random bytes as base64url without padding (43 characters). */
function newSyncKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function rotateSyncKey({ db, userId }: { db: Db; userId: string }): Promise<Response> {
  const key = newSyncKey();
  const { error } = await db.rpc('sync_key_rotate', {
    p_user_id: userId,
    p_key_hash: await sha256Hex(key),
  });
  if (error) {
    // 23503: the signed-in user has no profile row yet.
    if (error.code === '23503')
      return fail(409, 'no_profile', 'Finish setting up your profile first.');
    throw new Error(error.message);
  }
  return json(200, { ok: true, key });
}
