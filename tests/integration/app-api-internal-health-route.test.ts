/**
 * PROD-371 -- /api/internal/health behavior tests.
 *
 * Covers:
 *   - happy path: returns the documented JSON shape and 200
 *   - auth gating: 401 when INTERNAL_ADMIN_TOKEN is set and the bearer
 *     header is missing or wrong
 *   - dev convenience: open access when token unset and NODE_ENV != prod
 *
 * The vendor probes are mocked via globalThis.fetch so the test never
 * makes real network calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetEventBufferForTests, recordEvent } from '@/lib/observability/event-buffer';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  __resetEventBufferForTests();
  // Strip vendor envs by default so probes return 'not-configured' and we
  // don't depend on a network call inside unit tests.
  for (const k of [
    'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY',
    'AI_GATEWAY_API_KEY',
    'ASSEMBLYAI_API_KEY',
    'STRIPE_SECRET_KEY',
    'INTERNAL_ADMIN_TOKEN',
  ]) {
    delete process.env[k];
  }
  vi.stubEnv('NODE_ENV', 'test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

function buildRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/internal/health', {
    method: 'GET',
    headers,
  });
}

describe('app/api/internal/health -- happy path', () => {
  it('returns the documented payload shape with vendor + recent_errors fields', async () => {
    const route = await import('@/app/api/internal/health/route');

    recordEvent('error', 'route.error', { path: '/api/stripe/webhook' });
    recordEvent('warn', 'mcp.rate_limited', { tier: 'user_hour' });

    const res = await route.GET(buildRequest(), {});
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      uptime_seconds: expect.any(Number),
      vendors: {
        supabase: 'not-configured',
        ai_gateway: 'not-configured',
        assemblyai: 'not-configured',
        stripe: 'not-configured',
      },
      recent_errors: {
        stripe_webhook_failures_last_hour: 1,
        recording_failures_last_hour: 0,
        auth_errors_last_hour: 0,
        rate_limit_hits_last_hour: 1,
        vendor_500s_last_hour: 0,
      },
      active_users_last_hour: expect.any(Number),
      recordings_in_progress: expect.any(Number),
    });
    expect(body.buffer_note).toMatch(/in-memory/i);
  });

  it('reports a vendor as ok when the probe returns 200', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;

    const route = await import('@/app/api/internal/health/route');
    const res = await route.GET(buildRequest(), {});
    const body = await res.json();
    expect(body.vendors.stripe).toBe('ok');
  });

  it('reports a vendor as down when fetch throws', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const route = await import('@/app/api/internal/health/route');
    const res = await route.GET(buildRequest(), {});
    const body = await res.json();
    expect(body.vendors.stripe).toBe('down');
  });
});

describe('app/api/internal/health -- auth gating', () => {
  it('returns 401 when INTERNAL_ADMIN_TOKEN is set and bearer is missing', async () => {
    process.env.INTERNAL_ADMIN_TOKEN = 'secret-xyz';
    const route = await import('@/app/api/internal/health/route');

    const res = await route.GET(buildRequest(), {});
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('returns 401 when bearer is wrong', async () => {
    process.env.INTERNAL_ADMIN_TOKEN = 'secret-xyz';
    const route = await import('@/app/api/internal/health/route');

    const res = await route.GET(
      buildRequest({ authorization: 'Bearer wrong' }),
      {},
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 when bearer matches the configured token', async () => {
    process.env.INTERNAL_ADMIN_TOKEN = 'secret-xyz';
    const route = await import('@/app/api/internal/health/route');

    const res = await route.GET(
      buildRequest({ authorization: 'Bearer secret-xyz' }),
      {},
    );
    expect(res.status).toBe(200);
  });

  it('refuses unauth in production even when token is unset (fail-closed)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.INTERNAL_ADMIN_TOKEN;
    const route = await import('@/app/api/internal/health/route');

    const res = await route.GET(buildRequest(), {});
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.reason).toBe('missing_token_in_prod');
  });

  it('allows open access in dev when token unset', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.INTERNAL_ADMIN_TOKEN;
    const route = await import('@/app/api/internal/health/route');

    const res = await route.GET(buildRequest(), {});
    expect(res.status).toBe(200);
  });
});
