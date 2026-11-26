/**
 * Helpers for Deno function tests (docs/PLAN.md Appendix A3 layer 6). Tests run the real handlers
 * against the local Supabase stack (`supabase start`), so database results are checked for real.
 *
 * Connection: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment, otherwise read from
 * `supabase status -o env` (the local stack's keys are generated per machine; nothing is hard-coded).
 */
import { serviceClient, type Db } from './db.ts';
import { sha256Hex } from './http.ts';

async function run(cmd: string, args: string[]): Promise<string | undefined> {
  try {
    const out = await new Deno.Command(cmd, { args, stdout: 'piped', stderr: 'null' }).output();
    return out.success ? new TextDecoder().decode(out.stdout) : undefined;
  } catch {
    return undefined;
  }
}

async function localStatus(): Promise<Record<string, string>> {
  const args = ['status', '-o', 'env'];
  const text =
    (await run('supabase', args)) ??
    (Deno.build.os === 'windows'
      ? await run('cmd', ['/c', 'pnpm', 'exec', 'supabase', ...args])
      : await run('pnpm', ['exec', 'supabase', ...args]));
  if (!text) throw new Error('Local Supabase is not running: run `supabase start` first.');
  const vars: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (m?.[1] && m[2] !== undefined) vars[m[1]] = m[2];
  }
  return vars;
}

let cached: Db | undefined;
let connection: { url: string; key: string } | undefined;

export async function testDb(): Promise<Db> {
  if (cached) return cached;
  let url = Deno.env.get('SUPABASE_URL');
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    const status = await localStatus();
    url = status['API_URL'];
    key = status['SERVICE_ROLE_KEY'];
  }
  if (!url || !key) throw new Error('Could not find the local Supabase URL and service role key.');
  connection = { url, key };
  cached = serviceClient(url, key);
  return cached;
}

/** Turn on test mode with a fake app_now(). */
export async function setFakeNow(db: Db, iso: string): Promise<void> {
  const { error } = await db
    .from('app_config')
    .update({ test_mode: true, fake_now: iso })
    .eq('id', true);
  if (error) throw error;
}

/** Back to the real clock. */
export async function clearFakeNow(db: Db): Promise<void> {
  const { error } = await db
    .from('app_config')
    .update({ test_mode: false, fake_now: null })
    .eq('id', true);
  if (error) throw error;
}

export interface TestUser {
  id: string;
  /** The plaintext sync key (only its hash is stored). */
  key: string;
  /** A signed-in access token for /api calls. */
  accessToken: () => Promise<string>;
  remove: () => Promise<void>;
}

/** A throwaway user with a profile and a sync key. Removing it cascades to all its rows. */
export async function createTestUser(db: Db, homeTz = 'America/New_York'): Promise<TestUser> {
  const tag = crypto.randomUUID().slice(0, 8);
  const email = `fn-${tag}@toe-to-toe.test`;
  const password = crypto.randomUUID();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  const id = data.user.id;
  const profile = await db
    .from('users')
    .insert({ id, email, display_name: `Fn ${tag}`, username: `fn_${tag}`, default_tz: homeTz });
  if (profile.error) throw profile.error;
  const key = `test-key-${crypto.randomUUID()}`;
  const keyRow = await db.from('sync_keys').insert({ user_id: id, key_hash: await sha256Hex(key) });
  if (keyRow.error) throw keyRow.error;
  return {
    id,
    key,
    accessToken: async () => {
      // A separate client, so the shared service-role client never holds a user session.
      if (!connection) throw new Error('call testDb() first');
      const signIn = await serviceClient(connection.url, connection.key).auth.signInWithPassword({
        email,
        password,
      });
      if (signIn.error || !signIn.data.session) throw signIn.error ?? new Error('no session');
      return signIn.data.session.access_token;
    },
    remove: async () => {
      const { error: removeError } = await db.auth.admin.deleteUser(id);
      if (removeError) throw removeError;
    },
  };
}

/** Everything /sync writes for one user, in a stable order, for before/after comparisons. */
export async function snapshot(db: Db, userId: string): Promise<unknown> {
  const [hours, sourceHours, days] = await Promise.all([
    db.from('hours').select('*').eq('user_id', userId).order('hour_start_utc'),
    db
      .from('source_hours')
      .select('*')
      .eq('user_id', userId)
      .order('hour_start_utc')
      .order('source_name'),
    db.from('daily_stats').select('*').eq('user_id', userId).order('local_date'),
  ]);
  for (const r of [hours, sourceHours, days]) if (r.error) throw r.error;
  return { hours: hours.data, sourceHours: sourceHours.data, days: days.data };
}

/** Load a JSON fixture from tests/fixtures. */
export async function fixture(name: string): Promise<Record<string, unknown>> {
  const url = new URL(`../../../tests/fixtures/${name}`, import.meta.url);
  return JSON.parse(await Deno.readTextFile(url)) as Record<string, unknown>;
}
