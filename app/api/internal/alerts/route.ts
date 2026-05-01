/**
 * POST /api/internal/alerts -- synthetic alert dispatcher (PROD-371).
 *
 * Reads the in-memory event buffer, evaluates the threshold table, and
 * dispatches a Slack-Block-Kit-shaped payload to ALERT_WEBHOOK_URL when
 * any threshold is breached. When the env is unset, fires `alert.would_fire`
 * to stdout instead so the founder can dry-run thresholds.
 *
 * Invocation: manual for now (`curl -X POST /api/internal/alerts ...`).
 * Follow-up ticket idea: wire Vercel Cron at every-5-minute cadence so
 * the alerts evaluate themselves continuously.
 *
 * Auth: bearer `INTERNAL_ADMIN_TOKEN` (same gate as /health).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withRoute } from '@/lib/with-route';
import { checkInternalAuth } from '@/lib/observability/internal-auth';
import { dispatchAlerts } from '@/lib/observability/alerts';

export const POST = withRoute(async (req) => {
  const auth = checkInternalAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: 'unauthorized', reason: auth.reason ?? 'unauthorized' },
      { status: 401 },
    );
  }

  const result = await dispatchAlerts();
  return NextResponse.json(
    {
      fired: result.fired,
      webhook_configured: result.webhookConfigured,
      webhook_ok: result.webhookOk ?? null,
      webhook_status: result.webhookStatus ?? null,
      triggers: result.triggers,
      ts: new Date().toISOString(),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
});

/**
 * Allow GET for "dry run" -- evaluate the thresholds without firing.
 * Useful from a browser if the founder wants to peek at current state.
 */
export const GET = withRoute(async (req) => {
  const auth = checkInternalAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: 'unauthorized', reason: auth.reason ?? 'unauthorized' },
      { status: 401 },
    );
  }
  // Force the dispatcher into "no-op" by passing an unreachable webhook
  // and a fetch that throws. Simpler: import evaluateAlerts directly.
  const { evaluateAlerts } = await import('@/lib/observability/alerts');
  const { getRecentErrorMetrics } = await import('@/lib/observability/event-buffer');
  const triggers = evaluateAlerts(getRecentErrorMetrics());
  return NextResponse.json(
    {
      dry_run: true,
      triggers,
      ts: new Date().toISOString(),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
});
