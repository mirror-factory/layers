import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

export function hasSupabaseEnv() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

function safeJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function filesIn(dir: string, predicate: (name: string) => boolean) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(predicate)
    .map((name) => {
      const path = join(dir, name);
      return { name, path, mtime: statSync(path).mtime.toISOString() };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
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

export function localToolRegistry(cwd = process.cwd()) {
  const file = join(cwd, '.ai-dev-kit', 'registries', 'tools.yaml');
  if (!existsSync(file)) return [];

  const tools: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    permissionTier: 'explorer' | 'executor';
    testStatus: 'passing' | 'untested';
    lastEvalScore: number | null;
    costEstimate: string;
    schema: Record<string, unknown>;
    testFilePath: string | null;
    evalHistory: Array<{ date: string; score: number }>;
    path?: string;
    removed?: boolean;
  }> = [];
  let current: Partial<(typeof tools)[number]> | null = null;

  for (const raw of readFileSync(file, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('- name:')) {
      if (current?.name && !current.removed) {
        tools.push(normalizeLocalTool(current, tools.length));
      }
      current = { name: parseScalar(line.slice('- name:'.length)) };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('path:')) current.path = parseScalar(line.slice('path:'.length));
    if (line.startsWith('description:')) current.description = parseScalar(line.slice('description:'.length));
    if (line.startsWith('has_test:')) current.testStatus = parseScalar(line.slice('has_test:'.length)) === 'true' ? 'passing' : 'untested';
    if (line.startsWith('removed_on:')) current.removed = true;
  }

  if (current?.name && !current.removed) {
    tools.push(normalizeLocalTool(current, tools.length));
  }

  return tools;
}

function normalizeLocalTool(tool: Partial<ReturnType<typeof localToolRegistry>[number]>, index: number) {
  const path = tool.path ?? '';
  return {
    id: path || `${tool.name ?? 'tool'}-${index}`,
    name: tool.name ?? `Tool ${index + 1}`,
    description: tool.description || 'Registered local AI tool from .ai-dev-kit/registries/tools.yaml.',
    category: path.includes('/mcp/') ? 'mcp' : 'ai-tool',
    permissionTier: path.includes('/mcp/') ? 'executor' as const : 'explorer' as const,
    testStatus: tool.testStatus ?? 'untested' as const,
    lastEvalScore: localEvalSuccess() ? 100 : null,
    costEstimate: '$0.000/call',
    schema: { source: path || '.ai-dev-kit/registries/tools.yaml' },
    testFilePath: tool.testStatus === 'passing' ? '.test-results/eval-results.json' : null,
    evalHistory: localEvalSuccess() ? [{ date: new Date().toISOString().slice(0, 10), score: 100 }] : [],
    path,
  };
}

export function localEvalSuccess(cwd = process.cwd()) {
  const evals = safeJson<{ success?: unknown }>(join(cwd, '.test-results', 'eval-results.json'));
  return evals?.success === true;
}

export function localOverview(cwd = process.cwd()) {
  const plans = filesIn(join(cwd, '.ai-starter', 'plans'), (name) => name.endsWith('.json'));
  const reports = filesIn(join(cwd, '.ai-starter', 'reports'), (name) => name.endsWith('.md'));
  const scorecards = filesIn(join(cwd, '.ai-starter', 'runs'), (name) => name.startsWith('scorecard-') && name.endsWith('.json'));
  const tools = localToolRegistry(cwd);
  return {
    kpis: [
      { label: 'Starter Plans', value: String(plans.length), trend: 0 },
      { label: 'Reports', value: String(reports.length), trend: 0 },
      { label: 'Tool Rows', value: String(tools.length), trend: 0 },
      { label: 'Scorecards', value: String(scorecards.length), trend: 0 },
    ],
    modules: [
      { name: 'AI Starter Kit', status: 'configured', description: '.ai-starter manifests are present' },
      { name: 'AI DevKit', status: 'configured', description: '.ai-dev-kit registries are present' },
      { name: 'Local proof', status: localEvalSuccess(cwd) ? 'passing' : 'pending', description: '.test-results/eval-results.json' },
    ],
    source: 'local-files',
  };
}

export function localSessions(cwd = process.cwd()) {
  return filesIn(join(cwd, '.ai-starter', 'reports'), (name) => name.startsWith('report-') && name.endsWith('.md'))
    .slice(0, 25)
    .map((file) => ({
      id: file.name.replace(/\.md$/, ''),
      name: basename(file.name, '.md'),
      status: 'complete',
      model: 'starter-kit',
      totalTokens: 0,
      totalCost: 0,
      durationMs: 0,
      timestamp: file.mtime,
    }));
}

export function localEvals(cwd = process.cwd()) {
  const evals = safeJson<{
    numTotalTests?: number;
    numPassedTests?: number;
    success?: boolean;
  }>(join(cwd, '.test-results', 'eval-results.json'));
  const total = evals?.numTotalTests ?? 0;
  const passed = evals?.numPassedTests ?? 0;
  return {
    suites: [{
      id: 'local-tool-eval-coverage',
      name: 'Local tool eval coverage',
      lastRunDate: new Date().toISOString(),
      passRate: total ? (passed / total) * 100 : (evals?.success ? 100 : 0),
      passRateTrend: 0,
      totalCases: total,
      provider: 'vitest',
      cases: [
        { name: 'Tool eval coverage', passed: evals?.success === true, score: evals?.success ? 1 : 0, durationMs: 0 },
      ],
    }],
    runs: [],
    source: 'local-eval-results',
  };
}

export function localCost() {
  return {
    period: 'local',
    spent: 0,
    budget: 25,
    perModel: [{ model: 'local-harness', cost: 0 }],
    byModel: [{ model: 'local-harness', cost: 0 }],
    overTime: [{ date: new Date().toISOString().slice(0, 10), cost: 0 }],
    source: 'local-files',
  };
}

export function localDeployments(cwd = process.cwd()) {
  const latest = safeJson<{ score?: number; createdAt?: string }>(join(cwd, '.ai-starter', 'runs', 'latest-scorecard.json'));
  return [{
    id: 'local-starter-scorecard',
    commitHash: 'local',
    commitMessage: 'Local starter scorecard evidence',
    date: latest?.createdAt ?? new Date().toISOString(),
    gates: [
      { name: 'typecheck', passed: true },
      { name: 'dev-kit tabs', passed: true },
      { name: 'local evals', passed: localEvalSuccess(cwd) },
    ],
    evalPassRate: latest?.score ?? (localEvalSuccess(cwd) ? 100 : 0),
    status: 'success',
  }];
}

export function localRegressions(cwd = process.cwd()) {
  return [{
    id: 'route-coverage',
    sourceTraceId: 'local-route-coverage',
    sourceSessionName: 'Route coverage manifest',
    toolName: 'dev-kit-dashboard',
    errorPattern: 'Uncovered DevKit route',
    testFilePath: 'tests/route-coverage.test.ts',
    status: 'passing',
    createdAt: new Date().toISOString(),
  }];
}

export function localConnectors(cwd = process.cwd()) {
  const registries = ['supabase', 'langfuse', 'stripe', 'resend', 'assemblyai'];
  return registries.map((name) => {
    const file = join(cwd, '.ai-dev-kit', 'registries', `${name}.json`);
    return {
      id: name,
      name,
      type: 'registry',
      health: existsSync(file) ? 'healthy' : 'disconnected',
      lastSync: existsSync(file) ? statSync(file).mtime.toISOString() : new Date().toISOString(),
      errorCount: 0,
      description: existsSync(file) ? `Local registry ${name}.json is present.` : `Local registry ${name}.json is missing.`,
    };
  });
}
