import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Client } from '../lib/supabase.ts';
import { SignedIn } from './SignedIn.tsx';
import { SignIn } from './SignIn.tsx';

/** Phase 0 debug page (P0.7). Deliberately plain: the design pass comes in P1.1. */
export function DebugPage() {
  return (
    <main>
      <h1>Toe to Toe debug</h1>
      {supabase ? (
        <WithSession client={supabase} />
      ) : (
        <p role="alert">
          This build has no Supabase settings. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
        </p>
      )}
    </main>
  );
}

function WithSession({ client }: { client: Client }) {
  // undefined until supabase-js reports the stored session (or none).
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [client]);

  if (session === undefined) return <p>Loading…</p>;
  if (session === null) return <SignIn client={client} />;
  return <SignedIn client={client} session={session} />;
}
