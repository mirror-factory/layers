/**
 * Auto-scaffolded by scaffold-expect-tests.ts for /ask.
 *
 * Expect CLI drives a real browser from a natural-language plan. This file is
 * a route-owned test plan so coverage cannot drift as pages are added.
 *
 * Run:
 *   pnpm exec expect tui -u http://localhost:3001/ask \
 *     --browser-mode headless \
 *     -m "Use tests/expect/ask.expect.ts as the route plan. Verify the page loads, the primary action is discoverable, empty/loading/error states are readable, and mobile layout has no horizontal overflow." \
 *     -y
 *
 * Keep this file focused on user-visible behavior. Add route-specific checks
 * under EXPECT_PLAN as the page grows.
 */

export const EXPECT_ROUTE = "/ask";

export const EXPECT_PLAN = [
  'Load the route and confirm the page is visibly rendered with no console errors.',
  'Confirm the primary user action is discoverable and has a clear label.',
  'Confirm empty, loading, and blocked states use readable copy.',
  'Set a mobile viewport and confirm the page has no horizontal overflow.',
];
