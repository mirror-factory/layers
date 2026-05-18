/**
 * Watchlist tick orchestration (PROD-371).
 *
 * `runWatchlistTick()` is the single entrypoint called by:
 *   - the Vercel cron route /api/cron/watchlist-tick (every 5 min)
 *   - tests, which inject a fake `fetchImpl` and a fake `now`
 *
 * Responsibilities:
 *   1. Evaluate every watchlist condition via `evaluateWatchlist`.
 *   2. Filter out passing conditions and conditions still in cooldown.
 *   3. Dispatch a single grouped Slack-Block-Kit payload to ALERT_WEBHOOK_URL
 *      (or log `watchlist.would_fire` when unset).
 *   4. Record cooldowns for every fired condition.
 *   5. Append an entry to the rolling 24h tick log so the dashboard can
 *      show the recent alert history.
 *
 * The cron route only needs to surface the returned `WatchlistTickResult`
 * to its JSON response.
 */

import { log } from '../logger';
import {
  evaluateWatchlist,
  type WatchlistConditionId,
  type WatchlistConditionResult,
  type WatchlistContext,
} from './watchlist';
import {
  buildAlertPayload,
  type SlackBlockKitPayload,
} from '../observability/alerts';
import { isCoolingDown, markFired } from './cooldowns';
import { appendTickLog, type WatchlistTickLogEntry } from './tick-log';

export interface WatchlistTickResult {
  ts: string;
  evaluatedAt: number;
  results: WatchlistConditionResult[];
  /** Conditions that tripped *and* were not in cooldown. */
  fired: WatchlistConditionResult[];
  /** Conditions tripping but suppressed by cooldown. */
  suppressed: WatchlistConditionResult[];
  /** Conditions still passing. */
  passing: WatchlistConditionResult[];
  /** Whether we actually POSTed to ALERT_WEBHOOK_URL. */
  webhookConfigured: boolean;
  webhookOk?: boolean;
  webhookStatus?: number;
  payload: SlackBlockKitPayload | null;
}

export interface RunTickOptions {
  context?: WatchlistContext;
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
  now?: number;
  /** Skip the tick-log append (useful in unit tests). */
  skipLog?: boolean;
}

export async function runWatchlistTick(opts: RunTickOptions = {}): Promise<WatchlistTickResult> {
  const now = opts.now ?? Date.now();
  const ts = new Date(now).toISOString();
  const results = evaluateWatchlist({ ...opts.context, now });

  const tripped: WatchlistConditionResult[] = [];
  const passing: WatchlistConditionResult[] = [];
  for (const r of results) {
    if (r.passing) passing.push(r);
    else tripped.push(r);
  }

  // Filter tripped conditions by cooldown so we don't re-fire on every tick.
  const fired: WatchlistConditionResult[] = [];
  const suppressed: WatchlistConditionResult[] = [];
  for (const r of tripped) {
    const cooling = await isCoolingDown(r.cooldownKey, now);
    if (cooling) suppressed.push(r);
    else fired.push(r);
  }

  let payload: SlackBlockKitPayload | null = null;
  let webhookConfigured = false;
  let webhookOk: boolean | undefined;
  let webhookStatus: number | undefined;

  if (fired.length > 0) {
    payload = buildAlertPayload(
      fired.map(r => ({
        // The alerts payload builder expects the AlertTrigger shape; we
        // re-use it so the Slack message looks consistent with the existing
        // /api/internal/alerts output.
        metric: r.id as unknown as Parameters<typeof buildAlertPayload>[0][number]['metric'],
        threshold: r.threshold,
        observed: r.observed,
        severity: r.severity,
        summary: r.summary,
      })),
    );

    const webhookUrl = opts.webhookUrl ?? process.env.ALERT_WEBHOOK_URL;
    webhookConfigured = Boolean(webhookUrl);
    if (!webhookUrl) {
      log.warn('watchlist.would_fire', { fired, payload });
    } else {
      const fetchImpl = opts.fetchImpl ?? fetch;
      try {
        const res = await fetchImpl(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5_000),
        });
        webhookOk = res.ok;
        webhookStatus = res.status;
        log.info('watchlist.fired', {
          fired: fired.map(r => r.id),
          webhookStatus: res.status,
          webhookOk: res.ok,
        });
      } catch (err) {
        webhookOk = false;
        log.error('watchlist.dispatch_failed', {
          fired: fired.map(r => r.id),
          err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
        });
      }
    }

    // Mark cooldowns for every condition we just dispatched (or attempted).
    // We mark even on webhook failure so a flaky Slack doesn't cause a
    // page-storm; the next tick will retry once the cooldown lapses.
    for (const r of fired) {
      await markFired(r.cooldownKey, now);
    }
  } else {
    log.info('watchlist.tick.no_fire', {
      tripped: tripped.length,
      suppressed: suppressed.map(r => r.id),
    });
  }

  if (!opts.skipLog) {
    const entry: WatchlistTickLogEntry = {
      ts,
      firedIds: fired.map(r => r.id as WatchlistConditionId),
      suppressedIds: suppressed.map(r => r.id as WatchlistConditionId),
      webhookConfigured,
      webhookOk,
    };
    appendTickLog(entry, now);
  }

  return {
    ts,
    evaluatedAt: now,
    results,
    fired,
    suppressed,
    passing,
    webhookConfigured,
    webhookOk,
    webhookStatus,
    payload,
  };
}
