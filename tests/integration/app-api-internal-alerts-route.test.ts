/**
 * PROD-371 -- /api/internal/alerts behavior tests.
 *
 * The route reads metrics from the in-memory event buffer, evaluates the
 * threshold table, and POSTs a Slack-Block-Kit-shaped payload to
 * ALERT_WEBHOOK_URL when any threshold is breached.
 *
 * Tests cover:
 *   - happy path: no events -> no alerts fire, response shape correct
 *   - threshold breach: webhook receives a structured payload
 *   - threshold breach without webhook URL: log-only path is taken
 *   - per-threshold dispatcher logic, exercised against the buffer directly
 *   - auth gating
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetEventBufferForTests, recordEvent } from '@/lib/observability/event-buffer';
import {
  dispatchAlerts,
  evaluateAlerts,
  buildAlertPayload,
  DEFAULT_THRESHOLDS,
} from '@/lib/observability/alerts';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  __resetEventBufferForTests();
  for (const k of ['INTERNAL_ADMIN_TOKEN', 'ALERT_WEBHOOK_URL']) {
    delete process.env[k];
  }
  vi.stubEnv('NODE_ENV', 'test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

function buildPostRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/internal/alerts', {
    method: 'POST',
    headers,
  });
}

function fillBuffer(event: string, count: number, ctx: Record<string, unknown> = {}) {
  for (let i = 0; i < count; i++) {
    recordEvent('error', event, ctx);
  }
}

describe('lib/observability/alerts -- threshold logic', () => {
  it('returns no triggers when metrics are below thresholds', () => {
    const triggers = evaluateAlerts({
      stripe_webhook_failures_last_hour: 1,
      recording_failures_last_hour: 1,
      auth_errors_last_hour: 1,
      rate_limit_hits_last_hour: 1,
      vendor_500s_last_hour: 1,
    });
    expect(triggers).toEqual([]);
  });

  it('flags stripe webhook breach as critical', () => {
    const triggers = evaluateAlerts({
      stripe_webhook_failures_last_hour: 6,
      recording_failures_last_hour: 0,
      auth_errors_last_hour: 0,
      rate_limit_hits_last_hour: 0,
      vendor_500s_last_hour: 0,
    });
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      metric: 'stripe_webhook_failures_last_hour',
      severity: 'critical',
      observed: 6,
      threshold: DEFAULT_THRESHOLDS.stripeWebhookFailuresPerHour,
    });
  });

  it('flags rate-limit breach as warning', () => {
    const triggers = evaluateAlerts({
      stripe_webhook_failures_last_hour: 0,
      recording_failures_last_hour: 0,
      auth_errors_last_hour: 0,
      rate_limit_hits_last_hour: 101,
      vendor_500s_last_hour: 0,
    });
    expect(triggers).toHaveLength(1);
    expect(triggers[0].severity).toBe('warning');
  });

  it('builds a Slack-Block-Kit payload with header + section + context', () => {
    const triggers = evaluateAlerts({
      stripe_webhook_failures_last_hour: 6,
      recording_failures_last_hour: 0,
      auth_errors_last_hour: 0,
      rate_limit_hits_last_hour: 0,
      vendor_500s_last_hour: 0,
    });
    const payload = buildAlertPayload(triggers);
    expect(payload.text).toContain('CRITICAL');
    expect(payload.blocks.find(b => b.type === 'header')).toBeDefined();
    expect(payload.blocks.find(b => b.type === 'section')).toBeDefined();
    expect(payload.blocks.find(b => b.type === 'context')).toBeDefined();
  });
});

describe('lib/observability/alerts -- dispatchAlerts', () => {
  it('dispatches to ALERT_WEBHOOK_URL when a threshold breaches', async () => {
    fillBuffer('route.error', 6, { path: '/api/stripe/webhook' });

    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    const result = await dispatchAlerts({
      webhookUrl: 'https://hooks.slack.com/services/X/Y/Z',
      fetchImpl,
    });

    expect(result.fired).toBe(true);
    expect(result.webhookConfigured).toBe(true);
    expect(result.webhookOk).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const callArgs = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe('https://hooks.slack.com/services/X/Y/Z');
    const init = callArgs[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });

    const body = JSON.parse(init.body as string);
    expect(body.text).toMatch(/CRITICAL/);
    expect(body.blocks.length).toBeGreaterThan(0);
  });

  it('emits log-only alert.would_fire when ALERT_WEBHOOK_URL is unset', async () => {
    fillBuffer('mcp.rate_limited', 101);

    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await dispatchAlerts({ fetchImpl });

    expect(result.fired).toBe(true);
    expect(result.webhookConfigured).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not fire when no thresholds are breached', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await dispatchAlerts({
      webhookUrl: 'https://hooks.slack.com/services/X/Y/Z',
      fetchImpl,
    });
    expect(result.fired).toBe(false);
    expect(result.triggers).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('captures fetch errors as webhookOk=false', async () => {
    fillBuffer('route.error', 6, { path: '/api/stripe/webhook' });

    const fetchImpl = vi.fn(async () => {
      throw new Error('Slack down');
    }) as unknown as typeof fetch;

    const result = await dispatchAlerts({
      webhookUrl: 'https://hooks.slack.com/services/X/Y/Z',
      fetchImpl,
    });
    expect(result.fired).toBe(true);
    expect(result.webhookOk).toBe(false);
  });
});

describe('app/api/internal/alerts -- route behavior', () => {
  it('POST returns the dispatch outcome with triggers', async () => {
    fillBuffer('route.error', 6, { path: '/api/stripe/webhook' });
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/X/Y/Z';
    globalThis.fetch = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;

    const route = await import('@/app/api/internal/alerts/route');
    const res = await route.POST(buildPostRequest(), {});
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.fired).toBe(true);
    expect(body.webhook_configured).toBe(true);
    expect(body.webhook_ok).toBe(true);
    expect(body.triggers).toHaveLength(1);
    expect(body.triggers[0].metric).toBe('stripe_webhook_failures_last_hour');
  });

  it('POST returns fired=false when buffer is clean', async () => {
    const route = await import('@/app/api/internal/alerts/route');
    const res = await route.POST(buildPostRequest(), {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fired).toBe(false);
    expect(body.triggers).toEqual([]);
  });

  it('GET dry-runs without dispatching', async () => {
    fillBuffer('route.error', 6, { path: '/api/stripe/webhook' });
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/X/Y/Z';
    const fetchSpy = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;

    const route = await import('@/app/api/internal/alerts/route');
    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/internal/alerts', { method: 'GET' }),
      {},
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dry_run).toBe(true);
    expect(body.triggers.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 401 when INTERNAL_ADMIN_TOKEN set and bearer missing', async () => {
    process.env.INTERNAL_ADMIN_TOKEN = 'admin-key';
    const route = await import('@/app/api/internal/alerts/route');
    const res = await route.POST(buildPostRequest(), {});
    expect(res.status).toBe(401);
  });

  it('returns 200 when bearer matches', async () => {
    process.env.INTERNAL_ADMIN_TOKEN = 'admin-key';
    const route = await import('@/app/api/internal/alerts/route');
    const res = await route.POST(
      buildPostRequest({ authorization: 'Bearer admin-key' }),
      {},
    );
    expect(res.status).toBe(200);
  });
});
