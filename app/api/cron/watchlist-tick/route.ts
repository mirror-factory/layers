/**
 * GET/POST /api/cron/watchlist-tick -- 5-minute watchlist tick (PROD-371).
 *
 * Runs the watchlist evaluator, applies per-condition cooldowns, dispatches
 * to ALERT_WEBHOOK_URL when any condition trips, and appends to the rolling
 * 24h tick log.
 *
 * Auth (in order of preference):
 *   1. `Authorization: Bearer <CRON_SECRET>` — the Vercel Cron pattern.
 *      Vercel injects this header automatically when calling cron routes.
 *   2. `Authorization: Bearer <INTERNAL_ADMIN_TOKEN>` — the founder's
 *      curl token, same shared-secret as /api/internal/*.
 *
 * In development (`NODE_ENV !== 'production'`) with no secrets configured
 * the route is open so the founder can hit `curl http://localhost:3000/api/cron/watchlist-tick`.
 *
 * Methods:
 *   - GET: the canonical Vercel Cron entrypoint.
 *   - POST: same behavior, useful for manual scripted invocation.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withRoute } from '@/lib/with-route';
import { runWatchlistTick } from '@/lib/monitoring/tick';
import { listFiredTickLog } from '@/lib/monitoring/tick-log';

// ── Zod schemas (route contract, PROD-324) ────────────────────────────

/**
 * Cron route accepts no body. The optional `dryRun` query string lets the
 * founder peek at current state without dispatching alerts or marking
 * cooldowns. Anything else is rejected.
 */
const QuerySchema = z
  .object({
    dryRun: z
      .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
      .optional(),
  })
  .strict();

const ConditionResultSchema = z.object({
  id: z.enum([
    'spend_over_cap',
    'error_rate_over_threshold',
    'p95_latency_over_threshold',
    'transcript_failure_rate_over_threshold',
  ]),
  passing: z.boolean(),
  severity: z.enum(['warning', 'critical']),
  observed: z.number(),
  threshold: z.number(),
  unit: z.string(),
  summary: z.string(),
  cooldownKey: z.string(),
  sampleSize: z.number().optional(),
});

/**
 * Public response shape for the cron route. Exported so the dashboard and
 * other consumers can import the type for type-safe fetches.
 */
export const WatchlistTickResponseSchema = z.object({
  ts: z.string(),
  dry_run: z.boolean(),
  webhook_configured: z.boolean(),
  webhook_ok: z.boolean().nullable(),
  fired: z.array(ConditionResultSchema),
  suppressed: z.array(ConditionResultSchema),
  passing: z.array(ConditionResultSchema),
  recent_24h: z.array(
    z.object({
      ts: z.string(),
      firedIds: z.array(z.string()),
      suppressedIds: z.array(z.string()),
      webhookConfigured: z.boolean(),
      webhookOk: z.boolean().optional(),
    }),
  ),
});

export type WatchlistTickResponse = z.infer<typeof WatchlistTickResponseSchema>;

// ── Auth ──────────────────────────────────────────────────────────────

interface AuthResult {
  ok: boolean;
  reason?: 'missing_token_in_prod' | 'invalid_token';
}

function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function checkCronAuth(req: Request): AuthResult {
  const cronSecret = process.env.CRON_SECRET;
  const adminToken = process.env.INTERNAL_ADMIN_TOKEN;
  const isProd = process.env.NODE_ENV === 'production';
  const presented = parseBearer(req.headers.get('authorization'));

  // Dev convenience: no secrets, no auth.
  if (!cronSecret && !adminToken) {
    return isProd ? { ok: false, reason: 'missing_token_in_prod' } : { ok: true };
  }

  if (cronSecret && presented === cronSecret) return { ok: true };
  if (adminToken && presented === adminToken) return { ok: true };
  return { ok: false, reason: 'invalid_token' };
}

// ── Handler ───────────────────────────────────────────────────────────

async function handle(req: Request): Promise<Response> {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: 'unauthorized', reason: auth.reason ?? 'unauthorized' },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const queryParse = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!queryParse.success) {
    return NextResponse.json(
      { error: 'invalid_query', issues: queryParse.error.flatten() },
      { status: 400 },
    );
  }
  const dryRun = queryParse.data.dryRun === '1' || queryParse.data.dryRun === 'true';

  if (dryRun) {
    // For a dry-run we evaluate but don't dispatch and don't mark cooldowns.
    // Easiest way: skip the runner and just compute results inline.
    const { evaluateWatchlist } = await import('@/lib/monitoring/watchlist');
    const results = evaluateWatchlist({});
    const fired = results.filter(r => !r.passing);
    const passing = results.filter(r => r.passing);
    const payload: WatchlistTickResponse = {
      ts: new Date().toISOString(),
      dry_run: true,
      webhook_configured: Boolean(process.env.ALERT_WEBHOOK_URL),
      webhook_ok: null,
      fired,
      suppressed: [],
      passing,
      recent_24h: listFiredTickLog(),
    };
    return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } });
  }

  const result = await runWatchlistTick();
  const payload: WatchlistTickResponse = {
    ts: result.ts,
    dry_run: false,
    webhook_configured: result.webhookConfigured,
    webhook_ok: typeof result.webhookOk === 'boolean' ? result.webhookOk : null,
    fired: result.fired,
    suppressed: result.suppressed,
    passing: result.passing,
    recent_24h: listFiredTickLog(),
  };
  return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } });
}

export const GET = withRoute(handle);
export const POST = withRoute(handle);
