import type { Session } from '@supabase/supabase-js';
import type { Client } from '../lib/supabase.ts';
import { HealthCheckForm } from './HealthCheckForm.tsx';
import { StepsPanel } from './StepsPanel.tsx';
import { SyncKeyPanel } from './SyncKeyPanel.tsx';
import { useDebugData } from './use-debug-data.ts';

/** The signed-in part of /debug: sync key, counted steps and the Health check. */
export function SignedIn({ client, session }: { client: Client; session: Session }) {
  const { state, reload } = useDebugData(client, session.user.id);

  return (
    <>
      <p>
        Signed in as {session.user.email}.{' '}
        <button type="button" onClick={() => void client.auth.signOut()}>
          Sign out
        </button>{' '}
        <button type="button" onClick={reload}>
          Refresh
        </button>
      </p>
      {state.kind === 'loading' && <p>Loading…</p>}
      {state.kind === 'error' && <p role="alert">{state.message}</p>}
      {state.kind === 'ready' && state.data.status === null && (
        <p role="alert">
          No player profile for this email yet. Ask Jay to add you, then tap Refresh.
        </p>
      )}
      {state.kind === 'ready' && state.data.status && (
        <>
          {state.data.displayName && <p>Hi, {state.data.displayName}.</p>}
          <SyncKeyPanel accessToken={session.access_token} />
          <StepsPanel status={state.data.status} days={state.data.days} />
          <HealthCheckForm
            key={state.data.status.yesterday}
            client={client}
            userId={session.user.id}
            status={state.data.status}
            checks={state.data.checks}
            onSaved={reload}
          />
        </>
      )}
    </>
  );
}
