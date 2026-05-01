/**
 * GET /api/internal/health -- aggregated health snapshot for the founder
 * during the alpha (PROD-371).
 *
 * Combines three sources:
 *   1. Process uptime (Node-level, since Lambda cold start).
 *   2. Vendor reachability probes (parallel, short-timeout, never throws).
 *   3. In-memory event-buffer aggregates (route.error, mcp.rate_limited,
 *      funnel.upload_failure, etc.) over the last hour.
 *
 * Auth: bearer `INTERNAL_ADMIN_TOKEN`. In dev with the env unset the route
 * is open so the founder can `curl http://localhost:3000/api/internal/health`
 * during local development.
 *
 * Limitations (also documented in docs/INCIDENT_RUNBOOK.md):
 *   - The buffer is per-process. A horizontally-scaled deployment will
 *     give different numbers per request. Acceptable for 10 alpha users.
 *   - Buffer resets on deploy. A blank dashboard right after deploy is
 *     normal -- not a sign of recovery.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withRoute } from '@/lib/with-route';
import { checkInternalAuth } from '@/lib/observability/internal-auth';
import {
  getRecentErrorMetrics,
  activeUsersInWindow,
  recordingsInProgress,
} from '@/lib/observability/event-buffer';

type VendorStatus = 'ok' | 'degraded' | 'down' | 'not-configured';

interface VendorChecks {
  supabase: VendorStatus;
  ai_gateway: VendorStatus;
  assemblyai: VendorStatus;
  stripe: VendorStatus;
}

const FETCH_TIMEOUT_MS = 3_000;

async function probe(
  url: string,
  init: RequestInit,
  okStatuses: number[] = [],
): Promise<VendorStatus> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) return 'ok';
    if (okStatuses.includes(res.status)) return 'ok';
    if (res.status >= 500) return 'down';
    return 'degraded';
  } catch {
    return 'down';
  }
}

async function checkSupabase(): Promise<VendorStatus> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return 'not-configured';
  return probe(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

async function checkAiGateway(): Promise<VendorStatus> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return 'not-configured';
  // ai-gateway has no documented liveness endpoint that's safe to hit; we
  // probe the embeddings model list which 401s without auth (which means
  // the host is up). Auth header validation is enough to confirm "alive".
  return probe(
    'https://ai-gateway.vercel.sh/v1/models',
    { headers: { Authorization: `Bearer ${key}` } },
    [401, 403], // host reachable but auth-rejected = still "alive"
  );
}

async function checkAssemblyAI(): Promise<VendorStatus> {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) return 'not-configured';
  return probe('https://api.assemblyai.com/v2/account', {
    headers: { Authorization: key },
  });
}

async function checkStripe(): Promise<VendorStatus> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return 'not-configured';
  // /v1/balance is cheap and read-only. 401 means key dead but Stripe up;
  // we treat that as 'degraded' so the founder rotates the key.
  return probe(
    'https://api.stripe.com/v1/balance',
    { headers: { Authorization: `Bearer ${key}` } },
    [],
  );
}

export const GET = withRoute(async (req) => {
  const auth = checkInternalAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: 'unauthorized', reason: auth.reason ?? 'unauthorized' },
      { status: 401 },
    );
  }

  const [supabase, ai_gateway, assemblyai, stripe] = await Promise.all([
    checkSupabase(),
    checkAiGateway(),
    checkAssemblyAI(),
    checkStripe(),
  ]);

  const vendors: VendorChecks = { supabase, ai_gateway, assemblyai, stripe };
  const recent_errors = getRecentErrorMetrics();
  const uptime_seconds = Math.floor(process.uptime());

  return NextResponse.json(
    {
      uptime_seconds,
      vendors,
      recent_errors,
      active_users_last_hour: activeUsersInWindow(),
      recordings_in_progress: recordingsInProgress(),
      ts: new Date().toISOString(),
      buffer_note:
        'Metrics are sourced from an in-memory ring buffer (200 events) per process and reset on deploy. See docs/INCIDENT_RUNBOOK.md.',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
});
