/** JSON response helpers shared by the Edge Functions. */

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  // Sync totals and keys are per user and change on every request.
  'Cache-Control': 'no-store',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** CORS for routes the browser calls (/api). Bearer-token auth only, so `*` is safe. */
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
};

/** The same response with the CORS headers added. */
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** An error body: { ok: false, error: <code>, message: <human text> }. */
export function fail(status: number, error: string, message: string): Response {
  return json(status, { ok: false, error, message });
}

/** The token from `Authorization: Bearer <token>`, or undefined. */
export function bearerToken(req: Request): string | undefined {
  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1];
}

/**
 * Read the body as text, giving up once it passes `maxBytes` (413). Returns undefined when too big.
 */
export async function readTextLimited(req: Request, maxBytes: number): Promise<string | undefined> {
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) return undefined;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** SHA-256 of a UTF-8 string, lower-case hex (how sync_keys.key_hash is stored). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
