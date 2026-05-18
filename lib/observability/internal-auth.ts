/**
 * Tiny shared-secret gate for /api/internal/* (PROD-371).
 *
 * Auth model:
 *   - Production: requires `Authorization: Bearer <INTERNAL_ADMIN_TOKEN>`.
 *   - Dev (NODE_ENV !== 'production') AND token unset: open. The founder
 *     just wants to curl these endpoints without juggling secrets locally.
 *
 * This is intentionally smaller than full session auth -- the founder hits
 * these from a terminal during incidents.
 */

export interface InternalAuthResult {
  ok: boolean;
  reason?: 'missing_token_in_prod' | 'invalid_token';
}

export function checkInternalAuth(req: Request): InternalAuthResult {
  const expected = process.env.INTERNAL_ADMIN_TOKEN;
  const isProd = process.env.NODE_ENV === 'production';
  const presented = parseBearer(req.headers.get('authorization'));

  if (!expected) {
    if (isProd) {
      return { ok: false, reason: 'missing_token_in_prod' };
    }
    return { ok: true };
  }

  return presented === expected
    ? { ok: true }
    : { ok: false, reason: 'invalid_token' };
}

function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
