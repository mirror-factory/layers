/**
 * AI Logs Stats API — Aggregated statistics for the observability dashboard
 *
 * Copy to: app/api/ai-logs/stats/route.ts
 *
 * Returns: totalCalls, totalCost, totalTokens, avgTTFT, p95TTFT,
 *          errorRate, abortRate, modelBreakdown, costByDay, callsByDay,
 *          errorsByDay, toolFrequency, sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStats } from '@/lib/ai/telemetry';

// GET /api/ai-logs/stats — Aggregated statistics
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const stats = await getStats({
    userId: searchParams.get('userId') ?? undefined,
    since: searchParams.get('since') ?? undefined,
  });

  return NextResponse.json(stats);
}
