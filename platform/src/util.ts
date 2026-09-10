/** Small shared helpers: JSON responses, errors, constant-time comparison. */

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message }, status);
}

/**
 * Compare two secrets without leaking length/timing. We hash both sides so the
 * comparison is over fixed-width digests rather than raw strings.
 */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const digest = async (value: string) => {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
  };
  const [ha, hb] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}
