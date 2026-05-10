#!/usr/bin/env tsx
/**
 * Expect proof runner.
 *
 * The static coverage gate (`check-expect-coverage.ts`) is cheap and runs in
 * Tier 1. This command is the expensive AI browser proof. It is wired into
 * Tier 3 and only executes when EXPECT_RUN=1, so routine PRs do not silently
 * spend 30 minutes unless a UI/usability gate explicitly asks for it.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");

function envFlag(name: string): boolean {
  const value = process.env[name]?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

const shouldRun = envFlag("EXPECT_RUN");
const required = envFlag("EXPECT_REQUIRED");
const agent = process.env.EXPECT_AGENT?.trim() ?? "";
const target = process.env.EXPECT_TARGET ?? "changes";
const message = process.env.EXPECT_MESSAGE ?? "Test the changed user-facing flow and report usability, accessibility, visual, and interaction regressions.";
const url = process.env.EXPECT_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
const command = `pnpm exec expect tui --ci${agent ? ` --agent ${agent}` : ""} --target ${target} --output json --message ${JSON.stringify(message)} --yes${url ? ` --url ${url}` : ""}`;

function write(payload: Record<string, unknown>) {
  mkdirSync(evidenceDir, { recursive: true });
  const out = join(evidenceDir, "expect-proof.json");
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[expect-proof] wrote ${out}`);
}

if (!shouldRun) {
  write({
    runAt: new Date().toISOString(),
    pass: !required,
    skipped: true,
    required,
    reason: "EXPECT_RUN is not set to 1.",
    agent: agent || null,
    command,
  });
  if (required) {
    console.error("[expect-proof] EXPECT_REQUIRED=1 but EXPECT_RUN is not set.");
    process.exit(1);
  }
  console.log("[expect-proof] skipped; set EXPECT_RUN=1 to execute Expect browser proof.");
  process.exit(0);
}

const args = ["exec", "expect", "tui", "--ci", "--target", target, "--output", "json", "--message", message, "--yes"];
if (agent) args.push("--agent", agent);
if (url) args.push("--url", url);

console.log(`[expect-proof] pnpm ${args.join(" ")}`);
const start = Date.now();
const result = spawnSync("pnpm", args, {
  cwd,
  encoding: "utf-8",
  env: process.env,
});

const exitCode = typeof result.status === "number" ? result.status : 1;
const payload = {
  runAt: new Date().toISOString(),
  pass: exitCode === 0,
  skipped: false,
  required,
  agent: agent || null,
  target,
  url: url || null,
  durationMs: Date.now() - start,
  exitCode,
  stdout: result.stdout.slice(-20_000),
  stderr: result.stderr.slice(-20_000),
};
write(payload);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(exitCode);
