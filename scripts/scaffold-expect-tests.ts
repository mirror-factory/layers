#!/usr/bin/env tsx
/**
 * scaffold-expect-tests -- emit tests/expect/<slug>.expect.ts skeletons for
 * every route in .ai-dev-kit/registries/pages.yaml that doesn't already
 * have one. Never overwrites. Starts .skip so the push doesn't fail until
 * the author fills in real assertions.
 *
 * Runs: pnpm exec tsx scripts/scaffold-expect-tests.ts
 * Or: invoked by check-expect-coverage failure hint.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const PAGES = join(CWD, '.ai-dev-kit', 'registries', 'pages.yaml');
const OUT_DIR = join(CWD, 'tests', 'expect');

if (!existsSync(PAGES)) {
  console.log('[scaffold-expect] no pages.yaml; nothing to scaffold.');
  process.exit(0);
}

function loadRoutes(): string[] {
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

function skeleton(route: string, slug: string): string {
  return `/**
 * Auto-scaffolded by scaffold-expect-tests.ts for ${route}.
 *
 * Expect CLI drives a real browser from a natural-language plan. This file is
 * a route-owned test plan so coverage cannot drift as pages are added.
 *
 * Run:
 *   pnpm exec expect tui -u http://localhost:3001${route.includes('[') ? route.replace(/\[[^\]]+\]/g, 'sample') : route} \\
 *     --browser-mode headless \\
 *     -m "Use tests/expect/${slug}.expect.ts as the route plan. Verify the page loads, the primary action is discoverable, empty/loading/error states are readable, and mobile layout has no horizontal overflow." \\
 *     -y
 *
 * Keep this file focused on user-visible behavior. Add route-specific checks
 * under EXPECT_PLAN as the page grows.
 */

export const EXPECT_ROUTE = ${JSON.stringify(route)};

export const EXPECT_PLAN = [
  'Load the route and confirm the page is visibly rendered with no console errors.',
  'Confirm the primary user action is discoverable and has a clear label.',
  'Confirm empty, loading, and blocked states use readable copy.',
  'Set a mobile viewport and confirm the page has no horizontal overflow.',
];
`;
}

mkdirSync(OUT_DIR, { recursive: true });
const routes = loadRoutes();
let created = 0;
for (const route of routes) {
  const slug = routeToSlug(route);
  const out = join(OUT_DIR, slug + '.expect.ts');
  if (existsSync(out)) {
    console.log('  [exists] ' + route + ' -> ' + out.replace(CWD + '/', ''));
    continue;
  }
  writeFileSync(out, skeleton(route, slug));
  console.log('  [created] ' + route + ' -> ' + out.replace(CWD + '/', ''));
  created++;
}
console.log('[scaffold-expect] ' + created + ' skeleton(s) created across ' + routes.length + ' route(s).');
