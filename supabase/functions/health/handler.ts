export const VERSION = '0.1.0';

export function handler(): Response {
  return new Response(JSON.stringify({ ok: true, version: VERSION }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
