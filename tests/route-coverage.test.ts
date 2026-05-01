/**
 * PROD-320 -- Route coverage manifest test.
 *
 * Walks the `apiRouteContracts` manifest and asserts each route is exercised
 * by at least one test file (under `tests/integration/**` or another
 * non-smoke test file) that imports the route handler or references the
 * smoke path. Fails loudly if a route lacks coverage.
 *
 * This complements `tests/route-contracts.test.ts` which validates the
 * manifest shape; this file validates that the manifest is *backed by tests*.
 *
 * Pure `describe.todo(...)` stubs do not count as coverage, but we allow
 * them to coexist with real tests.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { apiRouteContracts } from "./api/route-contracts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TESTS_ROOT = resolve(ROOT, "tests");
const SKIP_DIRS = new Set(["e2e", "evals", "fixtures", "visual", "api"]);

function listTestFiles(dir = TESTS_ROOT): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = resolve(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      out.push(...listTestFiles(abs));
      continue;
    }
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) {
      out.push(relative(ROOT, abs));
    }
  }
  return out;
}

const allTestFiles = listTestFiles();
const testFileSources = new Map<string, string>();
for (const file of allTestFiles) {
  testFileSources.set(file, readFileSync(resolve(ROOT, file), "utf8"));
}

function importPathFromContract(file: string): string {
  // app/api/foo/bar/route.ts -> @/app/api/foo/bar/route
  return `@/${file.replace(/\.ts$/, "")}`;
}

function findCoveringTests(contractFile: string, smokePath: string): string[] {
  const importPath = importPathFromContract(contractFile);
  const relImport = `/${contractFile.replace(/\.ts$/, "")}`;
  // For dynamic-segment routes, also accept a smoke-path prefix that ignores
  // the trailing path segment (e.g. /api/meetings/sample matches references
  // to /api/meetings/<id>).
  const smokePrefix = smokePath.replace(/\/[^/]+$/, "");
  const matches: string[] = [];
  for (const [file, source] of testFileSources) {
    if (file === "tests/route-coverage.test.ts") continue;
    if (file === "tests/route-contracts.test.ts") continue;
    if (
      source.includes(importPath) ||
      source.includes(relImport) ||
      source.includes(smokePath) ||
      (smokePrefix.length > "/api".length && source.includes(smokePrefix))
    ) {
      matches.push(file);
    }
  }
  return matches;
}

function isStubOnly(file: string): boolean {
  const source = testFileSources.get(file) ?? "";
  const hasIt = /\bit\(/.test(source) || /\btest\(/.test(source);
  const hasTodo = /describe\.todo\(/.test(source);
  return hasTodo && !hasIt;
}

describe("API route coverage", () => {
  it("every route contract is referenced by at least one test file", () => {
    const uncovered: string[] = [];
    for (const contract of apiRouteContracts) {
      const matches = findCoveringTests(contract.file, contract.smokePath);
      if (matches.length === 0) {
        uncovered.push(`${contract.route} (${contract.file})`);
      }
    }
    expect(
      uncovered,
      `Routes lacking any test reference: ${uncovered.join(", ")}`,
    ).toEqual([]);
  });

  // PROD-320 follow-up: we currently allow some routes whose only test file
  // is a `describe.todo(...)` stub. The strict assertion below is skipped and
  // tracked under PROD-320 follow-up. As stubs are filled in with real tests,
  // remove names from `KNOWN_STUB_ONLY_ROUTES` until the list is empty, then
  // flip this test to active.
  const KNOWN_STUB_ONLY_ROUTES = new Set<string>([
    "app/api/ai-logs/errors/route.ts",
    "app/api/ai-logs/route.ts",
    "app/api/ai-logs/stats/route.ts",
    "app/api/control-plane/evidence-export/route.ts",
    "app/api/control-plane/route.ts",
    "app/api/admin/pricing/activate/route.ts",
    "app/api/admin/pricing/route.ts",
    "app/api/dev-kit/config/[name]/route.ts",
    "app/api/dev-kit/connectors/route.ts",
    "app/api/dev-kit/cost/route.ts",
    "app/api/dev-kit/coverage/route.ts",
    "app/api/dev-kit/dependencies/route.ts",
    "app/api/dev-kit/deployments/route.ts",
    "app/api/dev-kit/design-system/route.ts",
    "app/api/dev-kit/evals/[id]/route.ts",
    "app/api/dev-kit/evals/route.ts",
    "app/api/dev-kit/features/[name]/route.ts",
    "app/api/dev-kit/features/route.ts",
    "app/api/dev-kit/index/route.ts",
    "app/api/dev-kit/logs/unified/route.ts",
    "app/api/dev-kit/overview/route.ts",
    "app/api/dev-kit/registries/route.ts",
    "app/api/dev-kit/regressions/route.ts",
    "app/api/dev-kit/runs/[run_id]/route.ts",
    "app/api/dev-kit/runs/route.ts",
    "app/api/dev-kit/sessions/[id]/route.ts",
    "app/api/dev-kit/sessions/route.ts",
    "app/api/dev-kit/status/route.ts",
    "app/api/dev-kit/tools/route.ts",
    "app/api/embeddings/backfill/route.ts",
    "app/api/health/route.ts",
    "app/api/models/route.ts",
    "app/api/observability/health/route.ts",
  ]);

  it("no NEW route has only describe.todo() stub coverage", () => {
    const stubOnlyNew: string[] = [];
    for (const contract of apiRouteContracts) {
      const matches = findCoveringTests(contract.file, contract.smokePath);
      if (matches.length === 0) continue;
      const realMatches = matches.filter((f) => !isStubOnly(f));
      if (realMatches.length === 0 && !KNOWN_STUB_ONLY_ROUTES.has(contract.file)) {
        stubOnlyNew.push(`${contract.route} (${contract.file})`);
      }
    }
    expect(
      stubOnlyNew,
      `New stub-only routes (add a real integration test under tests/integration/): ${stubOnlyNew.join(", ")}`,
    ).toEqual([]);
  });

  it("known-stub allowlist does not regress without action", () => {
    // If a previously-stub route becomes covered by a real test, remove it
    // from KNOWN_STUB_ONLY_ROUTES. This test guards the allowlist from
    // accumulating dead entries.
    const stillStub: string[] = [];
    const newlyCovered: string[] = [];
    for (const file of KNOWN_STUB_ONLY_ROUTES) {
      const contract = apiRouteContracts.find((c) => c.file === file);
      if (!contract) continue;
      const matches = findCoveringTests(contract.file, contract.smokePath);
      const realMatches = matches.filter((f) => !isStubOnly(f));
      if (realMatches.length === 0) {
        stillStub.push(file);
      } else {
        newlyCovered.push(file);
      }
    }
    expect(
      newlyCovered,
      `Routes have real tests now -- remove from KNOWN_STUB_ONLY_ROUTES: ${newlyCovered.join(", ")}`,
    ).toEqual([]);
    // Sanity: every allowlist entry maps to a real contract.
    expect(stillStub.length + newlyCovered.length).toBe(KNOWN_STUB_ONLY_ROUTES.size);
  });
});
