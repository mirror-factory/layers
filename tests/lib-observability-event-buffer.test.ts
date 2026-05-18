/**
 * PROD-371 -- in-memory event-buffer correctness.
 *
 * The buffer powers /api/internal/health and /api/internal/alerts. These
 * tests pin the contract those routes rely on:
 *   - eviction at the 200-event cap
 *   - time-window queries respect the cutoff
 *   - the canonical "recent errors" aggregation maps event names -> metrics
 *     correctly for stripe webhook, transcribe, auth, mcp.rate_limited,
 *     external 5xx, and funnel signals
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  recordEvent,
  eventsInWindow,
  countEvents,
  getRecentErrorMetrics,
  activeUsersInWindow,
  recordingsInProgress,
  __resetEventBufferForTests,
  snapshotBuffer,
} from '@/lib/observability/event-buffer';

afterEach(() => {
  __resetEventBufferForTests();
});

describe('lib/observability/event-buffer -- ring buffer mechanics', () => {
  it('evicts oldest events past the 200-cap', () => {
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 250; i++) {
      recordEvent('info', `e.${i}`, { i }, t0 + i);
    }
    const snap = snapshotBuffer();
    expect(snap.length).toBe(200);
    // Oldest should be e.50 (250 - 200 = 50 dropped).
    expect(snap[0].event).toBe('e.50');
    expect(snap[snap.length - 1].event).toBe('e.249');
  });

  it('eventsInWindow drops events older than cutoff', () => {
    const now = 1_700_000_000_000;
    recordEvent('info', 'old', {}, now - 2 * 60 * 60 * 1000); // 2h ago
    recordEvent('info', 'recent', {}, now - 30 * 60 * 1000);   // 30m ago

    const lastHour = eventsInWindow(60 * 60 * 1000, now);
    expect(lastHour.map(e => e.event)).toEqual(['recent']);
  });

  it('countEvents matches by event name and level', () => {
    const now = 1_700_000_000_000;
    recordEvent('warn', 'mcp.rate_limited', {}, now);
    recordEvent('warn', 'mcp.rate_limited', {}, now);
    recordEvent('info', 'route.start', {}, now);

    expect(countEvents({ event: 'mcp.rate_limited' }, 60 * 60 * 1000, now)).toBe(2);
    expect(countEvents({ level: 'warn' }, 60 * 60 * 1000, now)).toBe(2);
    expect(countEvents({ event: 'route.start' }, 60 * 60 * 1000, now)).toBe(1);
  });
});

describe('lib/observability/event-buffer -- recent error metrics', () => {
  it('counts stripe webhook failures from route.error, route.end 4xx, and 5xx', () => {
    const now = 1_700_000_000_000;
    recordEvent('error', 'route.error', { path: '/api/stripe/webhook' }, now);
    recordEvent('info', 'route.end', { path: '/api/stripe/webhook', status: 500 }, now);
    // signature mismatch -> 400. Runbook scenario 6 explicitly wants this counted.
    recordEvent('info', 'route.end', { path: '/api/stripe/webhook', status: 400 }, now);
    recordEvent('info', 'route.end', { path: '/api/stripe/webhook', status: 200 }, now);
    // unrelated route should not count
    recordEvent('error', 'route.error', { path: '/api/other' }, now);

    const m = getRecentErrorMetrics(60 * 60 * 1000, now);
    expect(m.stripe_webhook_failures_last_hour).toBe(3);
  });

  it('counts recording failures from transcribe routes and funnel.upload_failure', () => {
    const now = 1_700_000_000_000;
    recordEvent('error', 'route.error', { path: '/api/transcribe' }, now);
    recordEvent('info', 'route.end', { path: '/api/transcribe/stream', status: 502 }, now);
    recordEvent('error', 'funnel.upload_failure', { recordingId: 'r1' }, now);

    const m = getRecentErrorMetrics(60 * 60 * 1000, now);
    expect(m.recording_failures_last_hour).toBe(3);
  });

  it('counts auth errors from /api/auth route failures and signin_struggle', () => {
    const now = 1_700_000_000_000;
    recordEvent('error', 'route.error', { path: '/api/auth/api-key' }, now);
    recordEvent('warn', 'funnel.signin_struggle', { userId: 'u1', attempts: 3 }, now);

    const m = getRecentErrorMetrics(60 * 60 * 1000, now);
    expect(m.auth_errors_last_hour).toBe(2);
  });

  it('counts mcp.rate_limited and vendor 5xx events', () => {
    const now = 1_700_000_000_000;
    recordEvent('warn', 'mcp.rate_limited', { tier: 'user_hour' }, now);
    recordEvent('warn', 'mcp.rate_limited', { tier: 'client_minute' }, now);
    recordEvent('error', 'external.error', { vendor: 'stripe' }, now);
    recordEvent('error', 'integration.fetch.failure', { integrationId: 'supabase' }, now);

    const m = getRecentErrorMetrics(60 * 60 * 1000, now);
    expect(m.rate_limit_hits_last_hour).toBe(2);
    expect(m.vendor_500s_last_hour).toBe(2);
  });

  it('time-windows the metrics correctly', () => {
    const now = 1_700_000_000_000;
    // 2 hours ago: should NOT count
    recordEvent('error', 'route.error', { path: '/api/stripe/webhook' }, now - 2 * 60 * 60 * 1000);
    // 30 min ago: should count
    recordEvent('error', 'route.error', { path: '/api/stripe/webhook' }, now - 30 * 60 * 1000);

    const m = getRecentErrorMetrics(60 * 60 * 1000, now);
    expect(m.stripe_webhook_failures_last_hour).toBe(1);
  });
});

describe('lib/observability/event-buffer -- gauges', () => {
  it('activeUsersInWindow counts distinct userId values', () => {
    const now = 1_700_000_000_000;
    recordEvent('info', 'route.start', { userId: 'a' }, now);
    recordEvent('info', 'route.start', { userId: 'a' }, now);
    recordEvent('info', 'route.start', { userId: 'b' }, now);
    recordEvent('info', 'route.start', {}, now); // anonymous, ignored

    expect(activeUsersInWindow(60 * 60 * 1000, now)).toBe(2);
  });

  it('recordingsInProgress = transcribe starts without terminal events', () => {
    const now = 1_700_000_000_000;
    // r1 -> started, no terminal -> in progress
    recordEvent('info', 'route.start', { path: '/api/transcribe', requestId: 'r1' }, now - 60_000);
    // r2 -> started + ended -> NOT in progress
    recordEvent('info', 'route.start', { path: '/api/transcribe/stream', requestId: 'r2' }, now - 30_000);
    recordEvent('info', 'route.end', { path: '/api/transcribe/stream', requestId: 'r2', status: 200 }, now - 20_000);
    // r3 -> started + errored -> NOT in progress
    recordEvent('info', 'route.start', { path: '/api/transcribe', requestId: 'r3' }, now - 10_000);
    recordEvent('error', 'route.error', { path: '/api/transcribe', requestId: 'r3' }, now - 5_000);

    expect(recordingsInProgress(now)).toBe(1);
  });
});
