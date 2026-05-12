/**
 * PROD-371 -- watchlist threshold evaluator unit tests.
 *
 * Pins the contract the cron route depends on:
 *   - spend %, error rate, p95 latency, and transcript failure rate are
 *     each computed from the documented inputs
 *   - sample-size floors prevent paging on noise
 *   - severity classification (critical vs warning) is stable
 */

import { afterEach, describe, expect, it } from 'vitest';
import { __resetEventBufferForTests, recordEvent } from '@/lib/observability/event-buffer';
import {
  evaluateWatchlist,
  evaluateSpend,
  evaluateErrorRate,
  evaluateP95Latency,
  evaluateTranscriptFailureRate,
  DEFAULT_WATCHLIST_THRESHOLDS,
} from '@/lib/monitoring/watchlist';

afterEach(() => {
  __resetEventBufferForTests();
});

describe('lib/monitoring/watchlist -- evaluateSpend', () => {
  it('passes when spend is below 80% of cap', () => {
    const r = evaluateSpend({ monthlySpendUsd: 100 }, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(true);
    expect(r.severity).toBe('warning');
  });

  it('fails when spend crosses 80% of cap', () => {
    const r = evaluateSpend({ monthlySpendUsd: 400 }, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(false);
    expect(r.severity).toBe('warning');
  });

  it('classifies 100%+ as critical', () => {
    const r = evaluateSpend({ monthlySpendUsd: 450 }, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(false);
    expect(r.severity).toBe('critical');
  });

  it('treats undefined spend as 0', () => {
    const r = evaluateSpend({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(true);
    expect(r.observed).toBe(0);
  });
});

describe('lib/monitoring/watchlist -- evaluateErrorRate', () => {
  it('passes when sample size is below the floor', () => {
    // 1 failure out of 5 = 20%, but min samples = 20, so we should not page.
    for (let i = 0; i < 4; i++) recordEvent('info', 'route.end', { status: 200 });
    recordEvent('error', 'route.error', { status: 500 });
    const r = evaluateErrorRate({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(true);
    expect(r.observed).toBe(20);
    expect(r.sampleSize).toBe(5);
  });

  it('fires when error rate crosses 1% with enough samples', () => {
    for (let i = 0; i < 99; i++) recordEvent('info', 'route.end', { status: 200 });
    for (let i = 0; i < 2; i++) recordEvent('error', 'route.error', { status: 500 });
    const r = evaluateErrorRate({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(false);
    expect(r.sampleSize).toBeGreaterThanOrEqual(20);
  });

  it('treats route.end with status >= 500 as a failure', () => {
    for (let i = 0; i < 19; i++) recordEvent('info', 'route.end', { status: 200 });
    recordEvent('warn', 'route.end', { status: 503 });
    const r = evaluateErrorRate({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(false);
    expect(r.observed).toBeCloseTo(5, 1);
  });
});

describe('lib/monitoring/watchlist -- evaluateP95Latency', () => {
  it('returns passing when sample size is small', () => {
    recordEvent('info', 'route.end', { path: '/api/chat', status: 200, durationMs: 9999 });
    const r = evaluateP95Latency({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(true);
    expect(r.sampleSize).toBe(1);
  });

  it('fires when p95 on key routes exceeds the threshold', () => {
    // 9 fast + 1 slow at 4s; p95 picks the slow one once we cross 10 samples.
    for (let i = 0; i < 9; i++) {
      recordEvent('info', 'route.end', { path: '/api/transcribe', status: 200, durationMs: 100 });
    }
    recordEvent('info', 'route.end', { path: '/api/transcribe', status: 200, durationMs: 4_500 });
    // Need 10+ samples; bump to 11.
    recordEvent('info', 'route.end', { path: '/api/transcribe', status: 200, durationMs: 200 });
    const r = evaluateP95Latency({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.sampleSize).toBeGreaterThanOrEqual(10);
    expect(r.passing).toBe(false);
    expect(r.observed).toBe(4_500);
  });

  it('ignores non-key routes', () => {
    for (let i = 0; i < 20; i++) {
      recordEvent('info', 'route.end', { path: '/api/health', status: 200, durationMs: 9_000 });
    }
    const r = evaluateP95Latency({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.sampleSize).toBe(0);
    expect(r.passing).toBe(true);
  });
});

describe('lib/monitoring/watchlist -- evaluateTranscriptFailureRate', () => {
  it('does not page below the sample floor', () => {
    recordEvent('error', 'route.error', { path: '/api/transcribe' });
    const r = evaluateTranscriptFailureRate({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(true);
  });

  it('fires above 5% failure with at least 5 attempts', () => {
    for (let i = 0; i < 9; i++) {
      recordEvent('info', 'route.end', { path: '/api/transcribe', status: 200 });
    }
    recordEvent('error', 'route.error', { path: '/api/transcribe' });
    const r = evaluateTranscriptFailureRate({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(false);
    expect(r.severity).toBe('critical');
    expect(r.sampleSize).toBe(10);
    expect(r.observed).toBeCloseTo(10, 1);
  });

  it('counts funnel.upload_failure as a transcript failure', () => {
    for (let i = 0; i < 4; i++) {
      recordEvent('info', 'route.end', { path: '/api/transcribe', status: 200 });
    }
    recordEvent('error', 'funnel.upload_failure', {});
    const r = evaluateTranscriptFailureRate({}, DEFAULT_WATCHLIST_THRESHOLDS);
    expect(r.passing).toBe(false);
    expect(r.observed).toBeCloseTo(20, 1);
  });
});

describe('lib/monitoring/watchlist -- evaluateWatchlist', () => {
  it('returns all four conditions', () => {
    const results = evaluateWatchlist({});
    expect(results.map(r => r.id)).toEqual([
      'spend_over_cap',
      'error_rate_over_threshold',
      'p95_latency_over_threshold',
      'transcript_failure_rate_over_threshold',
    ]);
  });

  it('every result has a stable cooldown key', () => {
    const results = evaluateWatchlist({});
    const keys = results.map(r => r.cooldownKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
