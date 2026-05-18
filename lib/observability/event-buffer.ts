/**
 * In-memory ring buffer of recent structured-log events.
 *
 * PROD-371 -- alpha-launch monitoring without external infra.
 *
 * The repo emits structured events through `lib/logger.ts` (route.start,
 * route.end, route.error, mcp.rate_limited, funnel.*, etc.). For a 10-user
 * alpha we don't need Datadog or Langfuse aggregation -- we just need to
 * answer questions like "how many stripe webhook failures in the last hour?"
 * from inside a Vercel serverless instance.
 *
 * This buffer keeps the last N events per Node process so that
 * `/api/internal/health` and `/api/internal/alerts` can answer those
 * questions directly. Events older than a one-hour window are still kept
 * (up to the buffer's capacity) so cold-start instances aren't completely
 * blind on first request.
 *
 * Limitations (documented in docs/INCIDENT_RUNBOOK.md):
 *   - Per-process: each Vercel Lambda has its own buffer. A single
 *     /alerts request only sees the events that the responding instance
 *     happened to handle. For a 10-user alpha that's acceptable.
 *   - Resets on deploy: events before the most recent deploy are gone.
 *   - Unbounded sinks: we cap the buffer at MAX_EVENTS to keep memory flat.
 *
 * Tests reset the buffer via `__resetEventBufferForTests()`.
 */

export type BufferedEventLevel = 'debug' | 'info' | 'warn' | 'error';

export interface BufferedEvent {
  ts: number;            // epoch ms
  level: BufferedEventLevel;
  event: string;         // event name e.g. 'route.error'
  /**
   * The remaining structured context, JSON-safe but not validated. Contains
   * fields like `path`, `status`, `userId`, `requestId`, `tier`, etc.
   * Consumers should treat unknown fields defensively.
   */
  ctx: Record<string, unknown>;
}

const MAX_EVENTS = 200;
const ONE_HOUR_MS = 60 * 60 * 1000;

const BUFFER: BufferedEvent[] = [];

/**
 * Append an event to the ring. Oldest entry is evicted when the cap is hit.
 */
export function recordEvent(
  level: BufferedEventLevel,
  event: string,
  ctx: Record<string, unknown> = {},
  now: number = Date.now(),
): void {
  BUFFER.push({ ts: now, level, event, ctx });
  if (BUFFER.length > MAX_EVENTS) {
    BUFFER.splice(0, BUFFER.length - MAX_EVENTS);
  }
}

/**
 * Return all buffered events whose timestamp is within `windowMs` of `now`.
 * Used by the alerts threshold logic.
 */
export function eventsInWindow(
  windowMs: number = ONE_HOUR_MS,
  now: number = Date.now(),
): BufferedEvent[] {
  const cutoff = now - windowMs;
  return BUFFER.filter(e => e.ts >= cutoff);
}

interface CountOptions {
  /** Match if event === name OR event.startsWith(`${name}.`). */
  event?: string;
  /** Match by level. */
  level?: BufferedEventLevel;
  /** Predicate over the ctx payload. */
  match?: (e: BufferedEvent) => boolean;
}

/**
 * Count buffered events matching all provided filters within the time window.
 */
export function countEvents(
  opts: CountOptions,
  windowMs: number = ONE_HOUR_MS,
  now: number = Date.now(),
): number {
  return eventsInWindow(windowMs, now).filter(e => {
    if (opts.event && e.event !== opts.event) return false;
    if (opts.level && e.level !== opts.level) return false;
    if (opts.match && !opts.match(e)) return false;
    return true;
  }).length;
}

/**
 * Snapshot of buffer state. Used by /api/internal/health to derive the
 * "recent_errors" object without re-iterating the buffer for each metric.
 */
export interface RecentErrorMetrics {
  stripe_webhook_failures_last_hour: number;
  recording_failures_last_hour: number;
  auth_errors_last_hour: number;
  rate_limit_hits_last_hour: number;
  vendor_500s_last_hour: number;
}

const STRIPE_WEBHOOK_PATH = '/api/stripe/webhook';
const TRANSCRIBE_PATH_PREFIX = '/api/transcribe';
const AUTH_PATH_PREFIX = '/api/auth';

function pathOf(e: BufferedEvent): string | null {
  const p = e.ctx.path;
  return typeof p === 'string' ? p : null;
}

function statusOf(e: BufferedEvent): number | null {
  const s = e.ctx.status;
  return typeof s === 'number' ? s : null;
}

/**
 * True when this event represents a route returning a 5xx status. Captures
 * both the success-then-5xx case (`route.end` with status >= 500) and the
 * thrown-error case (`route.error`, which always maps to 500 in withRoute).
 */
function isRouteFailure(e: BufferedEvent): boolean {
  if (e.event === 'route.error') return true;
  if (e.event === 'route.end') {
    const s = statusOf(e);
    return s !== null && s >= 500;
  }
  return false;
}

/**
 * Stripe webhook is a special case: its only "happy" status is 200. Any
 * 4xx (signature mismatch, missing header) is itself an incident -- the
 * runbook scenario 6 ("signature mismatch storm") needs us to count those.
 */
function isStripeWebhookFailure(e: BufferedEvent): boolean {
  if (pathOf(e) !== STRIPE_WEBHOOK_PATH) return false;
  if (e.event === 'route.error') return true;
  if (e.event === 'route.end') {
    const s = statusOf(e);
    return s !== null && s !== 200 && s !== 202;
  }
  return false;
}

export function getRecentErrorMetrics(
  windowMs: number = ONE_HOUR_MS,
  now: number = Date.now(),
): RecentErrorMetrics {
  const window = eventsInWindow(windowMs, now);

  let stripeFails = 0;
  let recordingFails = 0;
  let authErrors = 0;
  let rateLimitHits = 0;
  let vendor5xx = 0;

  for (const e of window) {
    const path = pathOf(e);

    if (isStripeWebhookFailure(e)) stripeFails++;
    if (isRouteFailure(e) && path?.startsWith(TRANSCRIBE_PATH_PREFIX)) recordingFails++;
    if (isRouteFailure(e) && path?.startsWith(AUTH_PATH_PREFIX)) authErrors++;
    if (e.event === 'mcp.rate_limited') rateLimitHits++;

    // Vendor 5xx: external-call failures captured by withExternalCall, plus
    // upstream-status events from trackedFetch / external HTTP probes.
    if (e.event === 'external.error') vendor5xx++;
    if (e.event === 'integration.fetch.failure') vendor5xx++;

    // Funnel signals that imply an upload failure also count toward
    // recording failures so the alert dispatcher catches both code paths.
    if (e.event === 'funnel.upload_failure') recordingFails++;

    // Funnel signal: signin struggle is a strong "auth has trouble" smell.
    if (e.event === 'funnel.signin_struggle') authErrors++;
  }

  return {
    stripe_webhook_failures_last_hour: stripeFails,
    recording_failures_last_hour: recordingFails,
    auth_errors_last_hour: authErrors,
    rate_limit_hits_last_hour: rateLimitHits,
    vendor_500s_last_hour: vendor5xx,
  };
}

/**
 * Number of unique userIds observed across `route.start` events in the
 * window. Used as a coarse "active users" gauge on the health endpoint.
 */
export function activeUsersInWindow(
  windowMs: number = ONE_HOUR_MS,
  now: number = Date.now(),
): number {
  const ids = new Set<string>();
  for (const e of eventsInWindow(windowMs, now)) {
    const u = e.ctx.userId;
    if (typeof u === 'string' && u.length > 0) ids.add(u);
  }
  return ids.size;
}

/**
 * Coarse "recordings in progress" estimate -- start events on the transcribe
 * routes minus terminal events for the same requestId. For the alpha this
 * approximates well enough to answer "is anything live right now?".
 */
export function recordingsInProgress(now: number = Date.now()): number {
  const FIVE_MIN = 5 * 60 * 1000;
  const recent = eventsInWindow(FIVE_MIN, now);
  const startsByRequestId = new Map<string, number>();
  const terminalRequestIds = new Set<string>();

  for (const e of recent) {
    const path = pathOf(e);
    if (!path?.startsWith(TRANSCRIBE_PATH_PREFIX)) continue;
    const requestId = typeof e.ctx.requestId === 'string' ? e.ctx.requestId : null;
    if (!requestId) continue;
    if (e.event === 'route.start') startsByRequestId.set(requestId, e.ts);
    if (e.event === 'route.end' || e.event === 'route.error') terminalRequestIds.add(requestId);
  }

  let inProgress = 0;
  for (const requestId of startsByRequestId.keys()) {
    if (!terminalRequestIds.has(requestId)) inProgress++;
  }
  return inProgress;
}

/**
 * Test helper -- empties the buffer between cases. Not exported through
 * an index so production code paths don't accidentally reach for it.
 */
export function __resetEventBufferForTests(): void {
  BUFFER.length = 0;
}

/**
 * Inspect helper for the alerts route -- returns a copy of the entire
 * buffer (unfiltered). Avoid using in hot paths; for diagnostics only.
 */
export function snapshotBuffer(): BufferedEvent[] {
  return BUFFER.slice();
}
