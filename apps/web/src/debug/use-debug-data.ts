import { useCallback, useEffect, useState } from 'react';
import type { Client } from '../lib/supabase.ts';

export interface SyncStatus {
  home_tz: string;
  today: string;
  yesterday: string;
  last_sync_at: string | null;
}

export interface DayRow {
  local_date: string;
  steps: number;
  status: string;
  sources: string[];
}

export interface CheckRow {
  local_date: string;
  health_steps: number;
}

export interface DebugData {
  displayName: string | null;
  /** Null when the signed-in user has no profile row yet. */
  status: SyncStatus | null;
  days: DayRow[];
  checks: CheckRow[];
}

type State =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: DebugData };

/** Everything the page shows, read through RLS with the signed-in user's token. */
async function load(client: Client, userId: string): Promise<DebugData> {
  const [profile, statusRes] = await Promise.all([
    client.from('users').select('display_name').eq('id', userId).maybeSingle(),
    // Home zone, today and yesterday from app_now(), last sync (sync_keys stays closed to clients).
    client.rpc('my_sync_status'),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (statusRes.error) throw new Error(statusRes.error.message);
  const status = (statusRes.data[0] as SyncStatus | undefined) ?? null;
  if (!status) return { displayName: null, status: null, days: [], checks: [] };

  const [days, checks] = await Promise.all([
    client
      .from('daily_stats')
      .select('local_date, steps, status, sources')
      .eq('user_id', userId)
      .in('local_date', [status.today, status.yesterday]),
    client
      .from('phase0_checks')
      .select('local_date, health_steps')
      .order('local_date', { ascending: false })
      .limit(7),
  ]);
  if (days.error) throw new Error(days.error.message);
  if (checks.error) throw new Error(checks.error.message);
  return {
    displayName: profile.data?.display_name ?? null,
    status,
    days: days.data,
    checks: checks.data,
  };
}

export function useDebugData(client: Client, userId: string) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    load(client, userId).then(
      (data) => {
        if (live) setState({ kind: 'ready', data });
      },
      (e: unknown) => {
        if (live) setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, userId, version]);

  return { state, reload };
}
