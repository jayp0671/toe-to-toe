import { useState } from 'react';
import { supabaseAnonKey, supabaseUrl } from '../lib/supabase.ts';

interface RotateBody {
  ok: boolean;
  key?: string;
  message?: string;
}

/** Calls POST /api/sync-key/rotate and shows the new key once. Leaving the page forgets it. */
export function SyncKeyPanel({ accessToken }: { accessToken: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (key && !window.confirm('Make a new key? The current one stops working right away.')) return;
    setBusy(true);
    setMessage(null);
    setCopied(false);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/api/sync-key/rotate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, apikey: supabaseAnonKey },
      });
      const body = (await res.json()) as RotateBody;
      if (res.ok && body.key) setKey(body.key);
      else setMessage(body.message ?? `Request failed (${res.status}).`);
    } catch {
      setMessage('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setMessage('Copy failed. Select the key and copy it by hand.');
    }
  }

  return (
    <section>
      <h2>Sync key</h2>
      <button type="button" onClick={generate} disabled={busy}>
        Generate sync key
      </button>
      {key && (
        <div>
          <p>
            Paste this into the Toe to Toe Sync Shortcut now. It is shown only once. Making a new
            one stops the old one.
          </p>
          <code data-testid="sync-key" style={{ userSelect: 'all', wordBreak: 'break-all' }}>
            {key}
          </code>{' '}
          <button type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
