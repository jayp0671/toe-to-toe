import { handler, VERSION } from './handler.ts';

Deno.test('health returns ok and version', async () => {
  const res = handler();
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
  const body: unknown = await res.json();
  const expected = JSON.stringify({ ok: true, version: VERSION });
  if (JSON.stringify(body) !== expected) {
    throw new Error(`unexpected body ${JSON.stringify(body)}`);
  }
});
