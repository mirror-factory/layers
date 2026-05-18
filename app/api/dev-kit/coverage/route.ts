/**
 * Coverage API  --  GET /api/dev-kit/coverage
 *
 * Returns tool coverage data: each tool from the registry enriched
 * with its test status and eval status so the dashboard can render
 * a coverage grid showing gaps.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

interface LocalToolEntry {
  name: string;
  path: string;
  hasTest: boolean;
  removed: boolean;
}

function parseScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readLocalEvalSuccess(cwd: string): boolean {
  const file = join(cwd, '.test-results', 'eval-results.json');
  if (!existsSync(file)) return false;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as { success?: unknown };
    return parsed.success === true;
  } catch {
    return false;
  }
}

function readLocalTools(cwd: string): LocalToolEntry[] {
  const file = join(cwd, '.ai-dev-kit', 'registries', 'tools.yaml');
  if (!existsSync(file)) return [];

  const entries: LocalToolEntry[] = [];
  let current: Partial<LocalToolEntry> | null = null;

  for (const raw of readFileSync(file, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('- name:')) {
      if (current?.name) {
        entries.push({
          name: current.name,
          path: current.path ?? '',
          hasTest: current.hasTest ?? false,
          removed: current.removed ?? false,
        });
      }
      current = {
        name: parseScalar(line.slice('- name:'.length)),
        path: '',
        hasTest: false,
        removed: false,
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('path:')) current.path = parseScalar(line.slice('path:'.length));
    if (line.startsWith('has_test:')) current.hasTest = parseScalar(line.slice('has_test:'.length)) === 'true';
    if (line.startsWith('removed_on:')) current.removed = true;
  }

  if (current?.name) {
    entries.push({
      name: current.name,
      path: current.path ?? '',
      hasTest: current.hasTest ?? false,
      removed: current.removed ?? false,
    });
  }

  return entries;
}

function localCoverage(cwd = process.cwd()): ToolCoverage[] {
  const evalSuccess = readLocalEvalSuccess(cwd);
  return readLocalTools(cwd)
    .filter((tool) => !tool.removed)
    .map((tool, index) => ({
      id: tool.path || `${tool.name}-${index}`,
      name: tool.name,
      category: tool.path.includes('/mcp/') ? 'mcp' : 'ai-tool',
      hasUnitTests: tool.hasTest,
      hasEvalCases: evalSuccess,
      testedInProduction: false,
      testStatus: tool.hasTest ? 'passing' : 'missing',
      lastEvalScore: evalSuccess ? 1 : null,
    }));
}

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        coverage: localCoverage(),
        source: 'local-tools-registry',
      });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
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

    return NextResponse.json({ coverage, source: 'supabase' });
  } catch (err) {
    console.error('[api/dev-kit/coverage] Error:', err);
    return NextResponse.json({
      coverage: localCoverage(),
      source: 'local-tools-registry',
      warning: err instanceof Error ? err.message : String(err),
    });
  }
}
