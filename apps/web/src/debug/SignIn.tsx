import { useState, type FormEvent } from 'react';
import type { Client } from '../lib/supabase.ts';
import { cleanOtpCode } from './debug-format.ts';

/** Email one-time-code sign-in: email, then the 6-digit code from the email (no magic links). */
export function SignIn({ client }: { client: Client }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;
    setBusy(true);
    setMessage(null);
    const { error } = await client.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSentTo(address);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    const token = cleanOtpCode(code);
    if (!token) {
      setMessage('The code is 6 digits.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await client.auth.verifyOtp({ email: sentTo, token, type: 'email' });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  if (!sentTo) {
    return (
      <form onSubmit={sendCode}>
        <h2>Sign in</h2>
        <label>
          Email{' '}
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>{' '}
        <button type="submit" disabled={busy}>
          Email me a code
        </button>
        {message && <p role="alert">{message}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={verify}>
      <h2>Enter your code</h2>
      <p>We sent a 6-digit code to {sentTo}.</p>
      <label>
        Code{' '}
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>{' '}
      <button type="submit" disabled={busy}>
        Sign in
      </button>{' '}
      <button
        type="button"
        onClick={() => {
          setSentTo(null);
          setCode('');
          setMessage(null);
        }}
      >
        Use a different email
      </button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
