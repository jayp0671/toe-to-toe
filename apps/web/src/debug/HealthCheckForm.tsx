import { useState, type FormEvent } from 'react';
import type { Client } from '../lib/supabase.ts';
import type { CheckRow, SyncStatus } from './use-debug-data.ts';
import { formatSteps, parseHealthSteps } from './debug-format.ts';

interface Props {
  client: Client;
  userId: string;
  status: SyncStatus;
  checks: CheckRow[];
  onSaved: () => void;
}

/** "Health says ___ steps": saves the tester's Health number to phase0_checks (own rows only). */
export function HealthCheckForm({ client, userId, status, checks, onSaved }: Props) {
  // Testers enter yesterday's final number each morning, so yesterday is the default.
  const [date, setDate] = useState(status.yesterday);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    const parsed = parseHealthSteps(text);
    if (!parsed.ok) {
      setMessage(parsed.message);
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await client
      .from('phase0_checks')
      .upsert(
        { user_id: userId, local_date: date, health_steps: parsed.steps },
        { onConflict: 'user_id,local_date' },
      );
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setText('');
    setMessage(`Saved ${formatSteps(parsed.steps)} for ${date}.`);
    onSaved();
  }

  return (
    <section>
      <h2>Health check</h2>
      <form onSubmit={save}>
        <label>
          Day{' '}
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            <option value={status.yesterday}>Yesterday ({status.yesterday})</option>
            <option value={status.today}>Today ({status.today})</option>
          </select>
        </label>{' '}
        <label>
          Health says{' '}
          <input
            inputMode="numeric"
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Steps the Health app shows"
          />{' '}
          steps
        </label>{' '}
        <button type="submit" disabled={busy}>
          Save
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {checks.length > 0 && (
        <ul>
          {checks.map((c) => (
            <li key={c.local_date}>
              {c.local_date}: Health said {formatSteps(c.health_steps)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
