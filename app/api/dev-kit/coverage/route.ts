/**
 * Coverage API  --  GET /api/dev-kit/coverage
 *
 * Returns tool coverage data: each tool from the registry enriched
 * with its test status and eval status so the dashboard can render
 * a coverage grid showing gaps.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  getToolRegistry,
  getRegressionTests,
  getEvalRuns,
} from '@/lib/ai-dev-kit/supabase-queries';

interface ToolCoverage {
  id: string;
  name: string;
  category: string;
  hasUnitTests: boolean;
  hasEvalCases: boolean;
  testedInProduction: boolean;
  testStatus: string;
  lastEvalScore: number | null;
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );

    const [tools, regressions, evalRuns] = await Promise.all([
      getToolRegistry(supabase),
      getRegressionTests(supabase),
      getEvalRuns(supabase),
    ]);

    // Build a set of tool names that have regression tests (tested in prod)
    const prodTestedTools = new Set(regressions.map((r) => r.tool_name));

    const hasEvalActivity = evalRuns.length > 0;

    const coverage: ToolCoverage[] = tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      hasUnitTests: tool.test_status === 'passing' || tool.test_status === 'failing',
      hasEvalCases: tool.last_eval_score !== null || hasEvalActivity,
      testedInProduction: prodTestedTools.has(tool.name),
      testStatus: tool.test_status,
      lastEvalScore: tool.last_eval_score,
    }));

    return NextResponse.json(coverage);
  } catch (err) {
    console.error('[api/dev-kit/coverage] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch coverage data' },
      { status: 500 },
    );
  }
}
