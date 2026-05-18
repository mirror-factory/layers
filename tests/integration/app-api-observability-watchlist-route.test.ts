/**
 * PROD-371 -- /api/observability/watchlist read-only snapshot tests.
 *
 * The dashboard hits this on every poll. The shape must stay stable:
 *   - ts, conditions[], thresholds, recentFired24h[], recentTicks24h[]
 *   - each condition exposes id/observed/threshold/severity/passing
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetEventBufferForTests, recordEvent } from '@/lib/observability/event-buffer';
import { __resetTickLogForTests, appendTickLog } from '@/lib/monitoring/tick-log';

beforeEach(() => {
  __resetEventBufferForTests();
  __resetTickLogForTests();
});

afterEach(() => {
  __resetEventBufferForTests();
  __resetTickLogForTests();
});

describe('app/api/observability/watchlist -- snapshot', () => {
  it('returns four watched conditions plus thresholds', async () => {
    const route = await import('@/app/api/observability/watchlist/route');
    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/observability/watchlist'),
      {},
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(typeof body.ts).toBe('string');
    expect(body.conditions).toHaveLength(4);
    expect(body.conditions.map((c: { id: string }) => c.id).sort()).toEqual([
      'error_rate_over_threshold',
      'p95_latency_over_threshold',
      'spend_over_cap',
      'transcript_failure_rate_over_threshold',
    ]);
    expect(body.thresholds).toMatchObject({
      spendPctOfCap: expect.any(Number),
      errorRatePct: expect.any(Number),
    });
    expect(Array.isArray(body.recentFired24h)).toBe(true);
    expect(Array.isArray(body.recentTicks24h)).toBe(true);
  });

  it('reflects buffered events in the live evaluation', async () => {
    for (let i = 0; i < 4; i++) recordEvent('info', 'route.end', { path: '/api/transcribe', status: 200 });
    for (let i = 0; i < 4; i++) recordEvent('error', 'route.error', { path: '/api/transcribe' });

    const route = await import('@/app/api/observability/watchlist/route');
    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/observability/watchlist'),
      {},
    );
    const body = await res.json();
    const transcript = body.conditions.find(
      (c: { id: string }) => c.id === 'transcript_failure_rate_over_threshold',
    );
    expect(transcript.passing).toBe(false);
    expect(transcript.severity).toBe('critical');
  });

  it('surfaces appended tick-log entries', async () => {
    appendTickLog({
      ts: new Date().toISOString(),
      firedIds: ['spend_over_cap'],
      suppressedIds: [],
      webhookConfigured: false,
    });
    const route = await import('@/app/api/observability/watchlist/route');
    const res = await route.GET(
      new NextRequest('http://localhost:3000/api/observability/watchlist'),
      {},
    );
    const body = await res.json();
    expect(body.recentFired24h.length).toBeGreaterThan(0);
    expect(body.recentTicks24h.length).toBeGreaterThan(0);
  });
});
