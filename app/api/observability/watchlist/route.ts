/**
 * GET /api/observability/watchlist -- watchlist state for the dashboard.
 *
 * Returns the current pass/fail state of every watchlist condition plus
 * the last 24h alert log. Read-only, public (same posture as
 * /api/observability/health) so the founder can render the dashboard from
 * any browser without juggling tokens during an incident.
 *
 * The watchlist evaluator is a pure function over the in-memory event
 * buffer; the only side effect is reading process state.
 */

import { NextResponse } from 'next/server';
import { withRoute } from '@/lib/with-route';
import {
  evaluateWatchlist,
  WATCHLIST_CONDITION_DESCRIPTIONS,
  DEFAULT_WATCHLIST_THRESHOLDS,
} from '@/lib/monitoring/watchlist';
import { listFiredTickLog, listTickLog } from '@/lib/monitoring/tick-log';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async () => {
  const results = evaluateWatchlist({});
  return NextResponse.json(
    {
      ts: new Date().toISOString(),
      conditions: results.map(r => ({
        ...r,
        description: WATCHLIST_CONDITION_DESCRIPTIONS[r.id],
      })),
      thresholds: DEFAULT_WATCHLIST_THRESHOLDS,
      recentFired24h: listFiredTickLog(),
      recentTicks24h: listTickLog().slice(-50),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
});
