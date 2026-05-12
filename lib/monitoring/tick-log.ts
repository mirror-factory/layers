/**
 * Rolling 24h log of watchlist tick outcomes (PROD-371).
 *
 * Used by the /observability dashboard to render "last 24h alert log".
 * Same in-memory limitations as the event buffer:
 *   - Per-process; not shared across instances.
 *   - Resets on deploy.
 *
 * For real persistence the consumer can swap the implementation behind
 * the same API (append/list). For the alpha, in-memory is acceptable.
 */

import type { WatchlistConditionId } from './watchlist';

export interface WatchlistTickLogEntry {
  ts: string;
  firedIds: WatchlistConditionId[];
  suppressedIds: WatchlistConditionId[];
  webhookConfigured: boolean;
  webhookOk?: boolean;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

const LOG: WatchlistTickLogEntry[] = [];

export function appendTickLog(entry: WatchlistTickLogEntry, now: number = Date.now()): void {
  LOG.push(entry);
  // Trim by max length first (cheap).
  if (LOG.length > MAX_ENTRIES) {
    LOG.splice(0, LOG.length - MAX_ENTRIES);
  }
  // Then trim by age. Walk from the front; once we hit a fresh entry, stop.
  const cutoff = now - ONE_DAY_MS;
  while (LOG.length > 0) {
    const head = LOG[0];
    const ts = Date.parse(head.ts);
    if (Number.isFinite(ts) && ts < cutoff) {
      LOG.shift();
    } else {
      break;
    }
  }
}

export function listTickLog(now: number = Date.now()): WatchlistTickLogEntry[] {
  const cutoff = now - ONE_DAY_MS;
  return LOG.filter(e => {
    const ts = Date.parse(e.ts);
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

/**
 * Only fired entries (i.e. conditions that actually paged) in the last 24h.
 */
export function listFiredTickLog(now: number = Date.now()): WatchlistTickLogEntry[] {
  return listTickLog(now).filter(e => e.firedIds.length > 0);
}

export function __resetTickLogForTests(): void {
  LOG.length = 0;
}
