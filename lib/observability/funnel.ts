/**
 * Funnel-signal helpers (PROD-371).
 *
 * The product has clear "should have happened by now" moments:
 *   - User attempts sign-in but fails 3x in a session.
 *   - User opens /record but never starts a recording in 5 min.
 *   - A recording fails to upload.
 *   - A user requests an integration we don't yet support.
 *
 * This module exposes thin wrappers around `log` so call sites read like
 * intent rather than logging plumbing. The events are picked up by the
 * in-memory event buffer (see ./event-buffer.ts) and surfaced via the
 * /api/internal/health and /api/internal/alerts routes.
 *
 * Usage:
 *   import { funnel } from '@/lib/observability/funnel';
 *   funnel.signinStruggle({ userId, attempts: 3 });
 *   funnel.idleRecord({ userId, sessionId });
 *   funnel.uploadFailure({ userId, recordingId, reason });
 *   funnel.integrationRequest({ provider: 'gmail', userId, surface: 'mcp' });
 */

import { log } from '../logger';

interface SigninStruggleCtx {
  userId?: string;
  attempts?: number;
  requestId?: string;
}

interface IdleRecordCtx {
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

interface UploadFailureCtx {
  userId?: string;
  recordingId?: string;
  reason?: string;
  requestId?: string;
}

interface IntegrationRequestCtx {
  provider: string;
  userId?: string;
  surface?: string;
  requestId?: string;
  reason?: string;
}

const KNOWN_PROVIDERS = new Set([
  'calendar',
  'gmail',
  'outlook',
  'slack',
  'linear',
  'notion',
]);

function normalizeProvider(provider: string): string {
  const lower = provider.toLowerCase().trim();
  return KNOWN_PROVIDERS.has(lower) ? lower : `other:${lower.slice(0, 32)}`;
}

export const funnel = {
  signinStruggle(ctx: SigninStruggleCtx = {}): void {
    log.warn('funnel.signin_struggle', { ...ctx });
  },
  idleRecord(ctx: IdleRecordCtx = {}): void {
    log.info('funnel.idle_record', { ...ctx });
  },
  uploadFailure(ctx: UploadFailureCtx = {}): void {
    log.error('funnel.upload_failure', { ...ctx });
  },
  integrationRequest(ctx: IntegrationRequestCtx): void {
    log.info('funnel.integration_request', {
      ...ctx,
      provider: normalizeProvider(ctx.provider),
    });
  },
};

/**
 * Convenience helper for handlers that take a Next/standard `Request` and
 * want to derive `provider` from a `?provider=` query param. Returns true
 * when the request shape matches the integration-request signal.
 */
export function maybeRecordIntegrationRequest(
  url: string,
  ctx: Omit<IntegrationRequestCtx, 'provider'> = {},
): boolean {
  try {
    const parsed = new URL(url);
    const provider = parsed.searchParams.get('provider');
    if (!provider) return false;
    funnel.integrationRequest({ ...ctx, provider });
    return true;
  } catch {
    return false;
  }
}
