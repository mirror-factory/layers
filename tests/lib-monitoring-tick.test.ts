/**
 * PROD-371 -- watchlist tick orchestration tests.
 *
 * Validates the slice that ties the evaluator + cooldowns + Slack dispatch
 * together. Covers:
 *   - dispatch on first tripped tick
 *   - cooldown suppresses re-paging on the next tick
 *   - cooldown lapses correctly when time advances
 *   - log-only fallback when ALERT_WEBHOOK_URL is unset
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetEventBufferForTests, recordEvent } from '@/lib/observability/event-buffer';
import { __resetCooldownsForTests } from '@/lib/monitoring/cooldowns';
import { __resetTickLogForTests, listTickLog } from '@/lib/monitoring/tick-log';
import { runWatchlistTick } from '@/lib/monitoring/tick';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  __resetEventBufferForTests();
  __resetCooldownsForTests();
  __resetTickLogForTests();
  for (const k of ['ALERT_WEBHOOK_URL', 'INTERNAL_ADMIN_TOKEN', 'CRON_SECRET']) {
    delete process.env[k];
  }
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/**
 * Seed the event buffer with enough samples to definitely trip the
 * transcript-failure-rate threshold (which is critical so the test doesn't
 * have to also seed `monthlySpendUsd` etc.).
 */
function seedTranscriptFailures() {
  for (let i = 0; i < 4; i++) recordEvent('info', 'route.end', { path: '/api/transcribe', status: 200 });
  for (let i = 0; i < 4; i++) recordEvent('error', 'route.error', { path: '/api/transcribe' });
}

describe('lib/monitoring/tick -- runWatchlistTick', () => {
  it('dispatches to ALERT_WEBHOOK_URL when a condition trips', async () => {
    seedTranscriptFailures();
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    const r = await runWatchlistTick({
      webhookUrl: 'https://hooks.slack.com/services/A/B/C',
      fetchImpl,
    });

    expect(r.fired.length).toBeGreaterThan(0);
    expect(r.webhookConfigured).toBe(true);
    expect(r.webhookOk).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const callArgs = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe('https://hooks.slack.com/services/A/B/C');
    const init = callArgs[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.text).toMatch(/CRITICAL|WARNING/);
  });

  it('falls back to log-only when ALERT_WEBHOOK_URL is unset', async () => {
    seedTranscriptFailures();
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const r = await runWatchlistTick({ fetchImpl });
    expect(r.fired.length).toBeGreaterThan(0);
    expect(r.webhookConfigured).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('suppresses re-paging within the cooldown window', async () => {
    seedTranscriptFailures();
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;

    const t0 = 1_700_000_000_000;
    const first = await runWatchlistTick({
      webhookUrl: 'https://hooks.slack.com/services/A/B/C',
      fetchImpl,
      now: t0,
    });
    expect(first.fired.length).toBeGreaterThan(0);

    // Re-seed so the condition is still tripping at t0 + 5 min.
    __resetEventBufferForTests();
    seedTranscriptFailures();

    const second = await runWatchlistTick({
      webhookUrl: 'https://hooks.slack.com/services/A/B/C',
      fetchImpl,
      now: t0 + 5 * 60 * 1000,
    });

    expect(second.fired.length).toBe(0);
    expect(second.suppressed.length).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // only the first tick fired
  });

  it('re-fires after the cooldown window lapses', async () => {
    seedTranscriptFailures();
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    const t0 = 1_700_000_000_000;

    await runWatchlistTick({
      webhookUrl: 'https://hooks.slack.com/services/A/B/C',
      fetchImpl,
      now: t0,
    });

    __resetEventBufferForTests();
    seedTranscriptFailures();

    const later = await runWatchlistTick({
      webhookUrl: 'https://hooks.slack.com/services/A/B/C',
      fetchImpl,
      now: t0 + 20 * 60 * 1000, // 20 min later -- past the 15 min cooldown
    });

    expect(later.fired.length).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('writes an entry to the rolling tick log on every run', async () => {
    seedTranscriptFailures();
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    await runWatchlistTick({
      webhookUrl: 'https://hooks.slack.com/services/A/B/C',
      fetchImpl,
    });
    const entries = listTickLog();
    expect(entries).toHaveLength(1);
    expect(entries[0].firedIds.length).toBeGreaterThan(0);
  });

  it('returns webhookOk=false when fetch throws', async () => {
    seedTranscriptFailures();
    const fetchImpl = vi.fn(async () => {
      throw new Error('Slack down');
    }) as unknown as typeof fetch;

    const r = await runWatchlistTick({
      webhookUrl: 'https://hooks.slack.com/services/A/B/C',
      fetchImpl,
    });
    expect(r.fired.length).toBeGreaterThan(0);
    expect(r.webhookOk).toBe(false);
  });
});
