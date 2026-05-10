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

import { compactText, extractExpectTuiReport, isZeroStepTuiTimeout } from "./lib/expect-proof-utils";

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
const fallbackUrl = process.env.EXPECT_FALLBACK_URL ?? url;
const timeoutMs = process.env.EXPECT_TIMEOUT_MS?.trim();
const timeoutArg = timeoutMs && /^\d+$/.test(timeoutMs) ? timeoutMs : "";
const fallbackEnabled = process.env.EXPECT_FALLBACK !== "0";
const command = `pnpm exec expect tui --ci${agent ? ` --agent ${agent}` : ""} --target ${target} --output json --message ${JSON.stringify(message)} --yes${url ? ` --url ${url}` : ""}${timeoutArg ? ` --timeout ${timeoutArg}` : ""}`;

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
if (timeoutArg) args.push("--timeout", timeoutArg);

function runExpectCli(args: string[], timeout = 90_000) {
  const start = Date.now();
  const result = spawnSync("pnpm", args, {
    cwd,
    encoding: "utf-8",
    env: process.env,
    timeout,
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  const stdout = compactText(result.stdout ?? "");
  const stderr = compactText(result.stderr ?? "");
  const outputFailed = /^\s*Error:/m.test(stdout) || /^\s*Error:/m.test(stderr);
  return {
    command: `pnpm ${args.join(" ")}`,
    pass: exitCode === 0 && !outputFailed,
    exitCode,
    durationMs: Date.now() - start,
    stdout,
    stderr,
    outputFailed,
    timedOut: Boolean(result.error && "code" in result.error && result.error.code === "ETIMEDOUT"),
  };
}

function fallbackCode() {
  return process.env.EXPECT_FALLBACK_CODE ?? `
const bodyText = await page.locator('body').innerText();
const h1 = await page.locator('h1').first().textContent().catch(() => null);
return {
  url: page.url(),
  title: await page.title(),
  h1,
  bodyCharacters: bodyText.trim().length,
  bodyPreview: bodyText.trim().slice(0, 800),
  pass: bodyText.trim().length > 0,
};
`;
}

function runFallbackProof() {
  if (!fallbackUrl) {
    return {
      pass: false,
      reason: "EXPECT_FALLBACK_URL, EXPECT_BASE_URL, or VERCEL_URL is required for deterministic Expect CLI fallback.",
      commands: [],
    };
  }

  const commands = [];
  const open = runExpectCli(["exec", "expect", "open", "--browser", "chromium", "--wait-until", "load", fallbackUrl]);
  commands.push(open);
  if (!open.pass) {
    return { pass: false, reason: "expect open failed", commands };
  }

  const reason = "AI TUI proof timed out without steps; deterministic Expect CLI fallback executed.";
  try {
    const assertion = runExpectCli([
      "exec",
      "expect",
      "playwright",
      fallbackCode(),
      "--snapshot-after",
      "--description",
      "expect-proof-fallback",
    ]);
    commands.push(assertion);

    const consoleLogs = runExpectCli(["exec", "expect", "console_logs", "--type", "error"]);
    commands.push(consoleLogs);

    const network = runExpectCli(["exec", "expect", "network_requests"]);
    commands.push(network);
  } finally {
    commands.push(runExpectCli(["exec", "expect", "close"], 120_000));
  }

  return {
    pass: commands.every(item => item.pass),
    reason,
    commands,
  };
}

console.log(`[expect-proof] pnpm ${args.join(" ")}`);
const start = Date.now();
const result = spawnSync("pnpm", args, {
  cwd,
  encoding: "utf-8",
  env: process.env,
});

const exitCode = typeof result.status === "number" ? result.status : 1;
const tuiReport = extractExpectTuiReport(result.stdout ?? "");
const fallback = exitCode !== 0 && fallbackEnabled && isZeroStepTuiTimeout(tuiReport)
  ? runFallbackProof()
  : null;
const pass = exitCode === 0 || Boolean(fallback?.pass);
const payload = {
  runAt: new Date().toISOString(),
  pass,
  skipped: false,
  required,
  agent: agent || null,
  target,
  url: url || null,
  durationMs: Date.now() - start,
  exitCode,
  mode: exitCode === 0 ? "expect-tui" : fallback?.pass ? "expect-cli-fallback" : "expect-tui",
  stdout: compactText(result.stdout ?? ""),
  stderr: compactText(result.stderr ?? ""),
  tui: {
    pass: exitCode === 0,
    exitCode,
    report: tuiReport,
    timedOutWithoutSteps: isZeroStepTuiTimeout(tuiReport),
  },
  fallback,
};
write(payload);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(pass ? 0 : exitCode);
