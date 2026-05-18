/**
 * Route coverage guard (PROD-324).
 *
 * Walks `app/api/**\/route.ts` on disk and asserts every discovered route
 * has a matching entry in `tests/api/route-contracts.ts`. New endpoints
 * land as a fast local failure here rather than as silent gaps in smoke
 * coverage downstream.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { apiRouteContracts } from "../api/route-contracts";

const REPO_ROOT = join(__dirname, "..", "..");
const API_ROOT = join(REPO_ROOT, "app", "api");

function walkRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walkRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      found.push(full);
    }
  }
  return found;
}

function toRepoRelativePosix(absolute: string): string {
  return relative(REPO_ROOT, absolute).split(sep).join("/");
}

describe("API route coverage guard", () => {
  it("every app/api/**/route.ts is registered in tests/api/route-contracts.ts", () => {
    const onDisk = walkRouteFiles(API_ROOT).map(toRepoRelativePosix).sort();
    const registered = new Set(apiRouteContracts.map((c) => c.file));

    const missing = onDisk.filter((path) => !registered.has(path));

    if (missing.length > 0) {
      const lines = [
        `${missing.length} API route(s) on disk are missing entries in tests/api/route-contracts.ts:`,
        ...missing.map((path) => `  - ${path}`),
        "",
        "Add each route to the apiRouteContracts array using the route() helper.",
      ].join("\n");
      throw new Error(lines);
    }

    expect(missing).toEqual([]);
  });

  it("route-contracts.ts does not reference routes that no longer exist on disk", () => {
    const onDisk = new Set(walkRouteFiles(API_ROOT).map(toRepoRelativePosix));
    const stale = apiRouteContracts.filter((c) => !onDisk.has(c.file));

    if (stale.length > 0) {
      const lines = [
        `${stale.length} contract(s) reference routes that are no longer on disk:`,
        ...stale.map((c) => `  - ${c.route}  (${c.file})`),
        "",
        "Remove these entries from apiRouteContracts.",
      ].join("\n");
      throw new Error(lines);
    }

    expect(stale).toEqual([]);
  });
});
