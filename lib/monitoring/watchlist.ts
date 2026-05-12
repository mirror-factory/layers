/**
 * Watchlist thresholds + evaluator (PROD-371).
 *
 * The synthetic alert dispatcher at `POST /api/internal/alerts`
 * (`lib/observability/alerts.ts`) covers raw error-rate metrics from the
 * in-memory event buffer. The **watchlist** layered on top of it adds the
 * "operational" conditions Alfonso actually wants to be paged on while the
 * alpha is live:
 *
 *   - spend > X% of monthly cap (placeholder — wired from env when a real
 *     spend feed is available; for now we look at the AI-logs in-memory
 *     stats, see `currentSpendUsd()`)
 *   - error rate > 1% over 5 min (over all `route.*` events in the buffer)
 *   - p95 latency > 3s on key routes (transcribe, chat, recording sign-upload)
 *   - transcript failure rate > 5% (recording_failures / recording_attempts)
 *
 * Pure functions. No I/O, no env-reading inside `evaluateWatchlist`. The
 * cron route assembles a `WatchlistContext` from real sources and hands it
 * here. Tests pass synthetic contexts.
 *
 * Cooldowns live in `cooldowns.ts` — we don't want to re-fire the same
 * alert every 5 min for the same hour-long blip.
 */

import {
  eventsInWindow,
  type BufferedEvent,
} from '../observability/event-buffer';

// ── Thresholds ────────────────────────────────────────────────────────

export interface WatchlistThresholds {
  /** Fire when monthly spend percentage of cap crosses this value (0-100). */
  spendPctOfCap: number;
  /** Hard monthly spend cap in USD that `spendPctOfCap` is computed against. */
  monthlySpendCapUsd: number;
  /** Fire when error rate (5xx / total) over `errorRateWindowMs` crosses this. */
  errorRatePct: number;
  errorRateWindowMs: number;
  /** Minimum sample size before computing error rate. */
  errorRateMinSamples: number;
  /** Fire when p95 latency on key routes crosses this (ms). */
  p95LatencyMs: number;
  p95LatencyWindowMs: number;
  /** Routes whose latency is included in the p95 calculation (startsWith match). */
  p95LatencyKeyRoutes: readonly string[];
  /** Fire when transcript failure rate over `transcriptFailureWindowMs` crosses this (0-100). */
  transcriptFailurePct: number;
  transcriptFailureWindowMs: number;
  /** Minimum sample size before computing transcript failure rate. */
  transcriptFailureMinSamples: number;
}

export const DEFAULT_WATCHLIST_THRESHOLDS: WatchlistThresholds = {
  // Spend
  spendPctOfCap: 80,
  monthlySpendCapUsd: 425, // matches docs/SPEND_CAPS.md "Total worst-case external monthly burn cap"
  // Error rate
  errorRatePct: 1,
  errorRateWindowMs: 5 * 60 * 1000,
  errorRateMinSamples: 20,
  // p95 latency
  p95LatencyMs: 3_000,
  p95LatencyWindowMs: 5 * 60 * 1000,
  p95LatencyKeyRoutes: [
    '/api/transcribe',
    '/api/chat',
    '/api/recordings/sign-upload',
  ],
  // Transcript failure rate
  transcriptFailurePct: 5,
  transcriptFailureWindowMs: 15 * 60 * 1000,
  transcriptFailureMinSamples: 5,
};

// ── Conditions ────────────────────────────────────────────────────────

export type WatchlistConditionId =
  | 'spend_over_cap'
  | 'error_rate_over_threshold'
  | 'p95_latency_over_threshold'
  | 'transcript_failure_rate_over_threshold';

export type WatchlistSeverity = 'warning' | 'critical';

export interface WatchlistConditionResult {
  id: WatchlistConditionId;
  passing: boolean;
  severity: WatchlistSeverity;
  observed: number;
  threshold: number;
  /** Human-readable units, e.g. "ms", "%", "USD". */
  unit: string;
  /** One-line summary suitable for Slack + dashboard. */
  summary: string;
  /** Stable cooldown key. Same condition + similar reason -> same key. */
  cooldownKey: string;
  /** Sample size used for ratio metrics; null when not applicable. */
  sampleSize?: number;
}

/**
 * Context the evaluator needs. Provided by the cron route. Pure data so
 * tests don't have to monkey-patch globals.
 */
export interface WatchlistContext {
  now?: number;
  thresholds?: WatchlistThresholds;
  /** Total external monthly spend in USD month-to-date. */
  monthlySpendUsd?: number;
  /** Optional override for events; defaults to the in-memory buffer. */
  events?: BufferedEvent[];
}

// ── Helpers ───────────────────────────────────────────────────────────

function pathOf(e: BufferedEvent): string | null {
  const p = e.ctx.path;
  return typeof p === 'string' ? p : null;
}

function statusOf(e: BufferedEvent): number | null {
  const s = e.ctx.status;
  return typeof s === 'number' ? s : null;
}

function durationOf(e: BufferedEvent): number | null {
  const d = e.ctx.durationMs;
  return typeof d === 'number' ? d : null;
}

function isRouteFailure(e: BufferedEvent): boolean {
  if (e.event === 'route.error') return true;
  if (e.event === 'route.end') {
    const s = statusOf(e);
    return s !== null && s >= 500;
  }
  return false;
}

function isRouteOutcome(e: BufferedEvent): boolean {
  return e.event === 'route.end' || e.event === 'route.error';
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[rank];
}

// ── Per-condition evaluators ──────────────────────────────────────────

export function evaluateSpend(
  context: WatchlistContext,
  thresholds: WatchlistThresholds,
): WatchlistConditionResult {
  const spend = context.monthlySpendUsd ?? 0;
  const cap = thresholds.monthlySpendCapUsd;
  const pct = cap > 0 ? (spend / cap) * 100 : 0;
  const passing = pct < thresholds.spendPctOfCap;

  return {
    id: 'spend_over_cap',
    passing,
    // Crossing 100% is a budget blowout; below that is a warning.
    severity: pct >= 100 ? 'critical' : 'warning',
    observed: Math.round(pct * 10) / 10,
    threshold: thresholds.spendPctOfCap,
    unit: '%',
    summary: passing
      ? `Spend at ${pct.toFixed(1)}% of $${cap} cap`
      : `Spend at ${pct.toFixed(1)}% of $${cap} cap (threshold ${thresholds.spendPctOfCap}%)`,
    cooldownKey: 'spend_over_cap',
  };
}

export function evaluateErrorRate(
  context: WatchlistContext,
  thresholds: WatchlistThresholds,
): WatchlistConditionResult {
  const now = context.now ?? Date.now();
  const events = context.events ?? eventsInWindow(thresholds.errorRateWindowMs, now);

  let total = 0;
  let failures = 0;
  for (const e of events) {
    if (!isRouteOutcome(e)) continue;
    total++;
    if (isRouteFailure(e)) failures++;
  }

  const rate = total > 0 ? (failures / total) * 100 : 0;
  // If we don't have a meaningful sample, treat as passing — a single 500 on
  // a slow afternoon shouldn't page. Min-sample check guards against this.
  const insufficient = total < thresholds.errorRateMinSamples;
  const passing = insufficient || rate < thresholds.errorRatePct;

  return {
    id: 'error_rate_over_threshold',
    passing,
    severity: 'warning',
    observed: Math.round(rate * 100) / 100,
    threshold: thresholds.errorRatePct,
    unit: '%',
    sampleSize: total,
    summary: insufficient
      ? `Error rate: ${failures}/${total} requests (below ${thresholds.errorRateMinSamples}-sample floor; not paging)`
      : passing
        ? `Error rate ${rate.toFixed(2)}% (${failures}/${total} requests)`
        : `Error rate ${rate.toFixed(2)}% (${failures}/${total} requests, threshold ${thresholds.errorRatePct}%)`,
    cooldownKey: 'error_rate_over_threshold',
  };
}

export function evaluateP95Latency(
  context: WatchlistContext,
  thresholds: WatchlistThresholds,
): WatchlistConditionResult {
  const now = context.now ?? Date.now();
  const events = context.events ?? eventsInWindow(thresholds.p95LatencyWindowMs, now);

  const durations: number[] = [];
  for (const e of events) {
    if (e.event !== 'route.end') continue;
    const path = pathOf(e);
    if (!path) continue;
    const isKey = thresholds.p95LatencyKeyRoutes.some(prefix => path.startsWith(prefix));
    if (!isKey) continue;
    const d = durationOf(e);
    if (d !== null) durations.push(d);
  }

  const p95 = percentile(durations, 95);
  // A handful of samples is statistically meaningless. Don't page on <10 reqs.
  const insufficient = durations.length < 10;
  const passing = insufficient || p95 < thresholds.p95LatencyMs;

  return {
    id: 'p95_latency_over_threshold',
    passing,
    severity: 'warning',
    observed: p95,
    threshold: thresholds.p95LatencyMs,
    unit: 'ms',
    sampleSize: durations.length,
    summary: insufficient
      ? `p95 latency: ${durations.length} samples on key routes (below 10-sample floor; not paging)`
      : passing
        ? `p95 latency ${p95}ms (${durations.length} samples on ${thresholds.p95LatencyKeyRoutes.join(', ')})`
        : `p95 latency ${p95}ms on key routes (threshold ${thresholds.p95LatencyMs}ms, ${durations.length} samples)`,
    cooldownKey: 'p95_latency_over_threshold',
  };
}

export function evaluateTranscriptFailureRate(
  context: WatchlistContext,
  thresholds: WatchlistThresholds,
): WatchlistConditionResult {
  const now = context.now ?? Date.now();
  const events = context.events ?? eventsInWindow(thresholds.transcriptFailureWindowMs, now);

  let attempts = 0;
  let failures = 0;
  for (const e of events) {
    const path = pathOf(e);
    const isTranscribe = path?.startsWith('/api/transcribe') === true;
    // Funnel signals also count as a transcript attempt outcome.
    if (isTranscribe && isRouteOutcome(e)) {
      attempts++;
      if (isRouteFailure(e)) failures++;
    }
    if (e.event === 'funnel.upload_failure') {
      attempts++;
      failures++;
    }
  }

  const rate = attempts > 0 ? (failures / attempts) * 100 : 0;
  const insufficient = attempts < thresholds.transcriptFailureMinSamples;
  const passing = insufficient || rate < thresholds.transcriptFailurePct;

  return {
    id: 'transcript_failure_rate_over_threshold',
    passing,
    severity: 'critical', // transcription is core product — page on this
    observed: Math.round(rate * 100) / 100,
    threshold: thresholds.transcriptFailurePct,
    unit: '%',
    sampleSize: attempts,
    summary: insufficient
      ? `Transcript failure rate: ${failures}/${attempts} attempts (below ${thresholds.transcriptFailureMinSamples}-sample floor; not paging)`
      : passing
        ? `Transcript failure rate ${rate.toFixed(2)}% (${failures}/${attempts} attempts)`
        : `Transcript failure rate ${rate.toFixed(2)}% (${failures}/${attempts} attempts, threshold ${thresholds.transcriptFailurePct}%)`,
    cooldownKey: 'transcript_failure_rate_over_threshold',
  };
}

// ── Top-level evaluator ───────────────────────────────────────────────

export function evaluateWatchlist(
  context: WatchlistContext = {},
): WatchlistConditionResult[] {
  const thresholds = context.thresholds ?? DEFAULT_WATCHLIST_THRESHOLDS;
  return [
    evaluateSpend(context, thresholds),
    evaluateErrorRate(context, thresholds),
    evaluateP95Latency(context, thresholds),
    evaluateTranscriptFailureRate(context, thresholds),
  ];
}

/**
 * Pretty list of all watched conditions for docs / dashboard hover state.
 * Keep in sync with the evaluators above.
 */
export const WATCHLIST_CONDITION_DESCRIPTIONS: Record<WatchlistConditionId, string> = {
  spend_over_cap:
    'Monthly external spend exceeds 80% of the documented $425 alpha cap (see docs/SPEND_CAPS.md).',
  error_rate_over_threshold:
    'Over the last 5 minutes, more than 1% of route outcomes are 5xx (min 20 samples).',
  p95_latency_over_threshold:
    'Over the last 5 minutes, p95 latency on /api/transcribe, /api/chat, /api/recordings/sign-upload exceeds 3000ms (min 10 samples).',
  transcript_failure_rate_over_threshold:
    'Over the last 15 minutes, more than 5% of /api/transcribe attempts (plus funnel.upload_failure) failed (min 5 samples).',
};
