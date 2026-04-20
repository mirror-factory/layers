/**
 * GET /api/dev-kit/runs -- list all runs.
 *
 * Source: .ai-dev-kit/state/runs/history/<run_id>.json
 *
 * Returns newest first (ULIDs sort by time). Each entry is the full run
 * record plus computed `totals` when available. The UI at
 * /dev-kit/runs renders one row per run with status + cost + duration.
 */
import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

interface RunRecord {
  run_id: string;
  feature_name: string | null;
  branch: string | null;
  task: string | null;
  started_at: string;
  ended_at?: string;
  status?: string;
  reason?: string | null;
  totals?: {
    ai_calls?: number;
    vendor_calls?: number;
    cost_usd?: number;
    tests_run?: number;
    tests_passed?: number;
    iterations?: number;
  };
}

export async function GET() {
  const dir = join(process.cwd(), '.ai-dev-kit', 'state', 'runs', 'history');
  if (!existsSync(dir)) return NextResponse.json({ runs: [] });

  const runs: RunRecord[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = readFileSync(join(dir, file), 'utf-8');
      runs.push(JSON.parse(raw));
    } catch { /* skip malformed */ }
  }

  runs.sort((a, b) => (b.run_id ?? '').localeCompare(a.run_id ?? ''));

  return NextResponse.json({ runs });
}
