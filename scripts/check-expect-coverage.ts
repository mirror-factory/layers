#!/usr/bin/env tsx
/**
 * check-expect-coverage -- pre-push gate that requires Expect AI browser test
 * plans for every page in pages.yaml.
 *
 * Motivation: visual regression catches "did it render" but not "does it
 * behave like a user expects". Expect AI drives a real browser and
 * asserts on what the user sees + can do. Without this gate, expect is
 * opt-in and agents skip it.
 *
 * Policy:
 *   * If pages.yaml is empty or missing: no-op (API-only project).
 *   * If pages.yaml has routes AND Expect is NOT a dep:
 *     warn-only on first push, FAIL on second push (tracked via
 *     .ai-dev-kit/state/expect-grace.json timestamp). Grace window is
 *     7 days so projects can adopt gradually.
 *   * If pages.yaml has routes AND expect IS a dep AND any route lacks
 *     a matching `tests/expect/<route-slug>.expect.ts`: FAIL.
 *   * Bypass: EXPECT_SKIP=1 (logged by audit-rebuild as silent regression).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const PAGES = join(CWD, '.ai-dev-kit', 'registries', 'pages.yaml');

if (process.env.EXPECT_SKIP === '1') {
  console.log('[check-expect-coverage] EXPECT_SKIP=1 set; skipping (silent regression).');
  process.exit(0);
}

function loadRoutes(): string[] {
  if (!existsSync(PAGES)) return [];
  const routes: string[] = [];
  let inEntries = false;
  for (const raw of readFileSync(PAGES, 'utf-8').split('\n')) {
    if (/^entries:/.test(raw)) { inEntries = true; continue; }
    if (!inEntries) continue;
    const m = raw.match(/^\s+-?\s*route:\s*(.+)$/);
    if (m) {
      const route = m[1].trim().replace(/^["']|["']$/g, '');
      if (route && !route.startsWith('/dev-kit')) routes.push(route);
    }
  }
  return routes;
}

function routeToSlug(route: string): string {
  return route.replace(/^\/|\/$/g, '').replace(/\[|\]/g, '').replace(/\//g, '-') || 'home';
}

function hasExpectDep(): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'));
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return 'expect-cli' in all || '@anthropic-ai/expect' in all;
  } catch { return false; }
}

const routes = loadRoutes();
if (routes.length === 0) {
  console.log('[check-expect-coverage] pages.yaml empty or missing; skipping.');
  process.exit(0);
}

if (!hasExpectDep()) {
  // 0.2.8: grace window removed. If pages.yaml has user-facing routes,
  // the project needs AI browser tests. Period. Bypass via EXPECT_SKIP=1.
  console.error('[check-expect-coverage] BLOCKED: expect-cli not installed.');
  console.error('  ' + routes.length + ' route(s) in pages.yaml need AI browser tests.');
  console.error('  Install: pnpm add -D expect-cli');
  console.error('  Then scaffold: pnpm exec tsx scripts/scaffold-expect-tests.ts');
  console.error('  Bypass (logged as silent regression): EXPECT_SKIP=1');
  process.exit(1);
}

// expect IS installed; require coverage per route.
const missing: string[] = [];
for (const route of routes) {
  const slug = routeToSlug(route);
  const candidates = [
    join(CWD, 'tests', 'expect', slug + '.expect.ts'),
    join(CWD, 'tests', 'expect', slug + '.spec.ts'),
    join(CWD, 'tests', 'expect', slug, 'index.expect.ts'),
  ];
  if (!candidates.some(p => existsSync(p))) missing.push(route + '  -> tests/expect/' + slug + '.expect.ts');
}

if (missing.length === 0) {
  console.log('[check-expect-coverage] OK: all ' + routes.length + ' routes have expect specs.');
  process.exit(0);
}

console.error('\n[check-expect-coverage] BLOCKED: ' + missing.length + ' of ' + routes.length + ' routes lack AI browser tests.');
console.error('');
for (const m of missing.slice(0, 12)) console.error('  ' + m);
if (missing.length > 12) console.error('  ... +' + (missing.length - 12) + ' more');
console.error('');
console.error('Every user-facing route needs an expect spec so the agent can\'t');
console.error('ship a feature that "renders" but doesn\'t actually work when a');
console.error('real user clicks through it.');
console.error('');
console.error('Scaffold all missing: `pnpm exec tsx scripts/scaffold-expect-tests.ts`');
console.error('Then fill in the assertions per-page.');
console.error('');
console.error('Bypass (not recommended; logged as silent regression):');
console.error('  EXPECT_SKIP=1 git push ...');
console.error('');
process.exit(1);
