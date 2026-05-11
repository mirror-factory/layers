#!/usr/bin/env tsx
/**
 * Fail-closed coverage sentry for high-risk harness surfaces.
 *
 * This is intentionally not a coverage percentage gate. It checks the minimum
 * test files that must stay active for chat, AI tools, MCP, and DevKit project
 * tabs so an agent cannot leave critical work as TODO scaffolding and still
 * claim Tier 1 green.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Check {
  name: string;
  status: "pass" | "fail";
  detail: string;
}

const cwd = process.cwd();
const checks: Check[] = [];

function read(path: string): string {
  return readFileSync(join(cwd, path), "utf-8");
}

function push(name: string, pass: boolean, detail: string) {
  checks.push({ name, status: pass ? "pass" : "fail", detail });
}

function fileHasActiveTests(path: string) {
  if (!existsSync(join(cwd, path))) {
    push(path, false, "file is missing");
    return "";
  }

  const source = read(path);
  const hasTodo = /\bdescribe\.todo\b|\bit\.todo\b|\btest\.todo\b/.test(source);
  const hasSkip = /\bdescribe\.skip\b|\bit\.skip\b|\btest\.skip\b/.test(source);
  const activeTests = (source.match(/\b(?:it|test)\s*\(/g) ?? []).length;

  push(`${path} has active tests`, !hasTodo && !hasSkip && activeTests > 0, `activeTests=${activeTests}, todo=${hasTodo}, skip=${hasSkip}`);
  return source;
}

function requireStrings(path: string, strings: string[]) {
  const source = fileHasActiveTests(path);
  if (!source) return;

  const missing = strings.filter((item) => !source.includes(item));
  push(`${path} required assertions`, missing.length === 0, missing.length === 0 ? "all required strings present" : `missing: ${missing.join(", ")}`);
}

requireStrings("tests/contracts/app-api-chat-route.contract.test.ts", [
  "/api/chat",
  "app/api/chat/route.ts",
  "messages: []",
  "requiresRequestId",
]);

requireStrings("tests/contracts/app-api-mcp-transport-route.contract.test.ts", [
  "/api/mcp/[transport]",
  "mcp-bearer",
  "application/json, text/event-stream",
  "initialize",
]);

requireStrings("tests/contracts/app-api-dev-kit-tools-route.contract.test.ts", [
  "/api/dev-kit/tools",
  "dev-kit",
  "dashboard proof",
]);

requireStrings("tests/api-route-behavior.test.ts", [
  "POST /api/chat rejects an empty message list before calling a model",
  "POST /api/chat requires authentication for valid chat requests",
  "POST /api/chat returns 404 when meeting-scoped chat points at a missing meeting",
  "POST /api/chat returns a local grounded meeting answer when no AI model is configured",
  "POST /api/search returns semantic results scoped to the current user",
]);

requireStrings("tests/tools/ai-tools.test.ts", [
  "AI tool registry",
  "searchMeetings validates input and scopes search to the current user",
  "getMeetingDetails validates input and returns normalized meeting context",
  "listRecentMeetings validates limits and normalizes meeting rows",
  "codeReview detects security risks and validates input",
]);

for (const path of [
  "tests/mcp/protocol.test.ts",
  "tests/mcp/auth.test.ts",
  "tests/mcp/tools.test.ts",
]) {
  fileHasActiveTests(path);
}

requireStrings("tests/e2e/app-dev-kit-tabs.smoke.spec.ts", [
  "/dev-kit",
  "/dev-kit/project",
  "/dev-kit/proof",
  "/dev-kit/runs",
  "/dev-kit/sessions",
  "/dev-kit/registries",
  "/dev-kit/design-system",
  "/dev-kit/config",
  "/dev-kit/status",
  "/dev-kit/tools",
  "/dev-kit/evals",
  "/dev-kit/cost",
  "/dev-kit/deployments",
  "/dev-kit/regressions",
  "/dev-kit/connectors",
  "/dev-kit/coverage",
]);

const pass = checks.every((check) => check.status === "pass");
const evidenceDir = join(cwd, ".evidence");
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, "critical-coverage.json"), JSON.stringify({
  runAt: new Date().toISOString(),
  pass,
  checks,
}, null, 2) + "\n");

for (const check of checks) {
  console.log(`[check-critical-coverage] ${check.status.toUpperCase()} ${check.name}: ${check.detail}`);
}

if (!pass) {
  console.error("[check-critical-coverage] BLOCKED: critical API/tool/chat/MCP/DevKit coverage is missing or inactive.");
  process.exit(1);
}
