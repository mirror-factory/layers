/**
 * PROD-371 -- /api/cron/watchlist-tick request/response contract.
 *
 * Pins:
 *   - the route is registered in the contract table with the right shape
 *   - auth is enforced (CRON_SECRET preferred, INTERNAL_ADMIN_TOKEN accepted)
 *   - GET (default) and POST behave the same way
 *   - dryRun=1 short-circuits without dispatching or marking cooldowns
 *   - the response shape stays JSON-stable so downstream consumers
 *     (Slack rule routing, the dashboard) don't break silently
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { apiRouteContracts } from '@/tests/api/route-contracts';
import { __resetEventBufferForTests, recordEvent } from '@/lib/observability/event-buffer';
import { __resetCooldownsForTests } from '@/lib/monitoring/cooldowns';
import { __resetTickLogForTests } from '@/lib/monitoring/tick-log';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  __resetEventBufferForTests();
  __resetCooldownsForTests();
  __resetTickLogForTests();
  for (const k of ['ALERT_WEBHOOK_URL', 'INTERNAL_ADMIN_TOKEN', 'CRON_SECRET']) {
    delete process.env[k];
  }
  vi.stubEnv('NODE_ENV', 'test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL_ENV };
});

function buildRequest(method: 'GET' | 'POST', headers: Record<string, string> = {}, search = '') {
  return new NextRequest(`http://localhost:3000/api/cron/watchlist-tick${search}`, {
    method,
    headers,
  });
}

describe('app/api/cron/watchlist-tick/route.ts request and response contract', () => {
  it('is registered as a service-auth route accepting GET + POST', () => {
    const contract = apiRouteContracts.find(
      c => c.file === 'app/api/cron/watchlist-tick/route.ts',
    );
    expect(contract).toMatchObject({
      route: '/api/cron/watchlist-tick',
      methods: ['GET', 'POST'],
      auth: 'service',
      requiresRequestId: true,
    });
  });

  it('returns a JSON envelope with passing/fired/suppressed arrays', async () => {
    const route = await import('@/app/api/cron/watchlist-tick/route');
    const res = await route.GET(buildRequest('GET'), {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ts: expect.any(String),
      dry_run: false,
      webhook_configured: expect.any(Boolean),
      webhook_ok: null, // no fire, no webhook attempt
    });
    expect(Array.isArray(body.fired)).toBe(true);
    expect(Array.isArray(body.suppressed)).toBe(true);
    expect(Array.isArray(body.passing)).toBe(true);
    expect(Array.isArray(body.recent_24h)).toBe(true);
    // Four canonical conditions, all passing on an empty buffer.
    expect(body.passing.map((c: { id: string }) => c.id).sort()).toEqual([
      'error_rate_over_threshold',
      'p95_latency_over_threshold',
      'spend_over_cap',
      'transcript_failure_rate_over_threshold',
    ]);
  });

  it('POST has the same behavior as GET', async () => {
    const route = await import('@/app/api/cron/watchlist-tick/route');
    const res = await route.POST(buildRequest('POST'), {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dry_run).toBe(false);
  });

  it('accepts the Vercel-Cron-injected CRON_SECRET bearer in prod', async () => {
    process.env.CRON_SECRET = 'vercel-cron-token';
    vi.stubEnv('NODE_ENV', 'production');
    const route = await import('@/app/api/cron/watchlist-tick/route');
    const res = await route.GET(
      buildRequest('GET', { authorization: 'Bearer vercel-cron-token' }),
      {},
    );
    expect(res.status).toBe(200);
  });

  it('also accepts INTERNAL_ADMIN_TOKEN as a fallback', async () => {
    process.env.INTERNAL_ADMIN_TOKEN = 'founder-key';
    vi.stubEnv('NODE_ENV', 'production');
    const route = await import('@/app/api/cron/watchlist-tick/route');
    const res = await route.GET(
      buildRequest('GET', { authorization: 'Bearer founder-key' }),
      {},
    );
    expect(res.status).toBe(200);
  });

  it('returns 401 in production with no bearer', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.CRON_SECRET = 'vercel-cron-token';
    const route = await import('@/app/api/cron/watchlist-tick/route');
    const res = await route.GET(buildRequest('GET'), {});
    expect(res.status).toBe(401);
  });

  it('returns 401 in production with the wrong bearer', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.CRON_SECRET = 'vercel-cron-token';
    const route = await import('@/app/api/cron/watchlist-tick/route');
    const res = await route.GET(
      buildRequest('GET', { authorization: 'Bearer nope' }),
      {},
    );
    expect(res.status).toBe(401);
  });

  it('rejects unknown query params with 400', async () => {
    const route = await import('@/app/api/cron/watchlist-tick/route');
    const res = await route.GET(buildRequest('GET', {}, '?wat=lol'), {});
    expect(res.status).toBe(400);
  });

  it('dryRun=1 evaluates without dispatching or marking cooldowns', async () => {
    // Seed an actually-tripping condition.
    for (let i = 0; i < 4; i++) recordEvent('info', 'route.end', { path: '/api/transcribe', status: 200 });
    for (let i = 0; i < 4; i++) recordEvent('error', 'route.error', { path: '/api/transcribe' });
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/A/B/C';
    const fetchSpy = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;

    const route = await import('@/app/api/cron/watchlist-tick/route');
    const res = await route.GET(buildRequest('GET', {}, '?dryRun=1'), {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dry_run).toBe(true);
    expect(body.fired.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fires when a condition trips and ALERT_WEBHOOK_URL is configured', async () => {
    for (let i = 0; i < 4; i++) recordEvent('info', 'route.end', { path: '/api/transcribe', status: 200 });
    for (let i = 0; i < 4; i++) recordEvent('error', 'route.error', { path: '/api/transcribe' });
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/A/B/C';
    const fetchSpy = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;

    const route = await import('@/app/api/cron/watchlist-tick/route');
    const res = await route.GET(buildRequest('GET'), {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fired.length).toBeGreaterThan(0);
    expect(body.webhook_configured).toBe(true);
    expect(body.webhook_ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
