/**
 * AI Logs API — Backend for the observability dashboard
 *
 * Copy to: app/api/ai-logs/route.ts
 * Also create: app/api/ai-logs/stats/route.ts (see below)
 *              app/api/ai-logs/errors/route.ts (see below)
 *
 * All endpoints return JSON. Add auth middleware in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLogs } from '@/lib/ai/telemetry';

// GET /api/ai-logs — List AI call logs with optional filters
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const logs = await getLogs({
    userId: searchParams.get('userId') ?? undefined,
    chatId: searchParams.get('chatId') ?? undefined,
    label: searchParams.get('label') ?? undefined,
    limit: parseInt(searchParams.get('limit') ?? '100', 10),
    since: searchParams.get('since') ?? undefined,
    errorsOnly: searchParams.get('errorsOnly') === 'true',
  });

  return NextResponse.json(logs);
}
