#!/usr/bin/env tsx
/**
 * Expect proof runner.
 *
 * The static coverage gate (`check-expect-coverage.ts`) is cheap and runs in
 * Tier 1. This command is the expensive AI browser proof. It is wired into
 * Tier 3 and only executes when EXPECT_RUN=1, so routine PRs do not silently
 * spend 30 minutes unless a UI/usability gate explicitly asks for it.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { compactText, extractExpectTuiReport, isZeroStepTuiTimeout, shouldRunExpectFallback } from "./lib/expect-proof-utils";

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
const timeoutMs = process.env.EXPECT_TIMEOUT_MS?.trim();
const timeoutArg = timeoutMs && /^\d+$/.test(timeoutMs) ? timeoutMs : "";
const tuiTimeoutMs = process.env.EXPECT_TUI_TIMEOUT_MS?.trim();
const tuiTimeoutArg = tuiTimeoutMs && /^\d+$/.test(tuiTimeoutMs) ? Number(tuiTimeoutMs) : 180_000;
const fallbackEnabled = process.env.EXPECT_FALLBACK !== "0";
const forceFallback = envFlag("EXPECT_FORCE_FALLBACK");
const autoStartServer = process.env.EXPECT_AUTO_START_SERVER !== "0";
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

function normalizeUrl(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return "";
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (/^\d+$/.test(candidate)) return `http://127.0.0.1:${candidate}`;
  return `https://${candidate}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function playwrightConfigPorts(): string[] {
  const ports: string[] = [];
  for (const file of ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs", "playwright.config.cjs"]) {
    const fullPath = join(cwd, file);
    if (!existsSync(fullPath)) continue;
    const source = readFileSync(fullPath, "utf-8");
    for (const match of source.matchAll(/(?:localhost|127\.0\.0\.1):(\d+)/g)) {
      ports.push(match[1]);
    }
  }
  return ports;
}

function nextDevProcessPorts(): string[] {
  const result = spawnSync("ps", ["-eo", "args="], {
    cwd,
    encoding: "utf-8",
    timeout: 3_000,
  });
  if (result.status !== 0) return [];

  const ports: string[] = [];
  for (const line of (result.stdout ?? "").split("\n")) {
    if (!/\bnext\b.*\bdev\b/.test(line)) continue;
    const match = line.match(/(?:^|\s)(?:-p|--port)\s+(\d+)(?:\s|$)/);
    if (match) ports.push(match[1]);
  }
  return ports;
}

function fallbackUrlCandidates(): string[] {
  const explicit = [
    process.env.EXPECT_FALLBACK_URL,
    url,
    process.env.TEST_BASE_URL,
    process.env.PLAYWRIGHT_BASE_URL,
    process.env.AI_STARTER_BASE_URL,
    process.env.BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].map(normalizeUrl);

  const localPorts = unique([
    process.env.PORT,
    process.env.NEXT_PORT,
    ...playwrightConfigPorts(),
    ...nextDevProcessPorts(),
    "3000",
    "3101",
    "3002",
    "4000",
  ].filter((value): value is string => Boolean(value?.trim())));

  return unique([
    ...explicit,
    ...localPorts.map(port => `http://127.0.0.1:${port}`),
  ]);
}

function isUrlReachable(candidate: string): boolean {
  const probe = `
const target = process.argv[1];
const mod = target.startsWith("https:") ? require("node:https") : require("node:http");
const req = mod.request(target, { method: "GET", timeout: 1500 }, res => {
  res.resume();
  process.exit(res.statusCode && res.statusCode < 500 ? 0 : 2);
});
req.on("timeout", () => req.destroy(new Error("timeout")));
req.on("error", () => process.exit(1));
req.end();
`;
  const result = spawnSync(process.execPath, ["-e", probe, candidate], {
    cwd,
    encoding: "utf-8",
    timeout: 3_000,
  });
  return result.status === 0;
}

function sleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function localPortFromUrl(candidate: string): string | null {
  try {
    const parsed = new URL(candidate);
    if (!["127.0.0.1", "localhost", "0.0.0.0", "::1", "[::1]"].includes(parsed.hostname)) return null;
    return parsed.port || null;
  } catch {
    return null;
  }
}

function canAutoStartServer(candidate: string): boolean {
  if (!autoStartServer) return false;
  const port = localPortFromUrl(candidate);
  return Boolean(port && port !== "3001");
}

interface ManagedExpectServer {
  url: string;
  command: string;
  pid: number | null;
  ready: boolean;
  timeoutMs: number;
  durationMs: number;
  stopped: boolean;
  error?: string;
}

function serverCommandFor(candidate: string): string {
  const port = localPortFromUrl(candidate) ?? "";
  const template = process.env.EXPECT_SERVER_COMMAND?.trim();
  if (template) {
    return template.replaceAll("{port}", port).replaceAll("{url}", candidate);
  }
  return `pnpm dev --port ${port}`;
}

function waitForReachableUrl(candidate: string, timeoutMs: number): boolean {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isUrlReachable(candidate)) return true;
    sleep(500);
  }
  return isUrlReachable(candidate);
}

function startManagedServer(candidate: string): ManagedExpectServer {
  const port = localPortFromUrl(candidate);
  const timeoutMsRaw = process.env.EXPECT_SERVER_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutMsRaw && /^\d+$/.test(timeoutMsRaw) ? Number(timeoutMsRaw) : 120_000;
  const command = serverCommandFor(candidate);
  const server: ManagedExpectServer = {
    url: candidate,
    command,
    pid: null,
    ready: false,
    timeoutMs,
    durationMs: 0,
    stopped: false,
  };
  const startedAt = Date.now();

  try {
    const child = spawn("bash", ["-lc", command], {
      cwd,
      detached: true,
      env: {
        ...process.env,
        ...(port ? { PORT: port, NEXT_PORT: port } : {}),
      },
      stdio: "ignore",
    });
    child.unref();
    server.pid = child.pid ?? null;
    server.ready = waitForReachableUrl(candidate, timeoutMs);
  } catch (error) {
    server.error = error instanceof Error ? error.message : String(error);
  } finally {
    server.durationMs = Date.now() - startedAt;
  }

  return server;
}

function stopManagedServer(server: ManagedExpectServer | null) {
  if (!server || server.stopped || !server.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
    server.stopped = true;
  } catch (error) {
    server.error = `${server.error ? `${server.error}; ` : ""}stop failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function listReplayFiles(dir: string): Array<{ path: string; bytes: number }> {
  const files: Array<{ path: string; bytes: number }> = [];
  if (!existsSync(dir)) return files;

  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = statSync(full);
      files.push({ path: relative(cwd, full), bytes: stat.size });
    }
  }

  walk(dir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function runReplayCapture(targetUrl: string) {
  const startedAt = Date.now();
  const replayDir = join(cwd, ".expect", "replays", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(replayDir, { recursive: true });

  const script = `
const targetUrl = process.argv[1];
const replayDir = process.argv[2];
const {chromium} = await import("@playwright/test");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: {width: 1440, height: 1000},
  recordVideo: {dir: replayDir, size: {width: 1440, height: 1000}},
});
const page = await context.newPage();
const response = await page.goto(targetUrl, {waitUntil: "networkidle", timeout: 60000});
const bodyText = await page.locator("body").innerText({timeout: 10000}).catch(() => "");
await page.screenshot({path: replayDir + "/page.png", fullPage: true});
await context.close();
await browser.close();
console.log(JSON.stringify({
  status: response ? response.status() : null,
  url: page.url(),
  title: await page.title().catch(() => ""),
  bodyCharacters: bodyText.trim().length,
  bodyPreview: bodyText.trim().slice(0, 500)
}));
`;

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, targetUrl, replayDir], {
    cwd,
    encoding: "utf-8",
    env: process.env,
    timeout: 120_000,
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  const files = listReplayFiles(replayDir);
  const videoFiles = files.filter((file) => file.path.endsWith(".webm"));
  const screenshotFiles = files.filter((file) => file.path.endsWith(".png"));
  const pass = exitCode === 0 && videoFiles.length > 0 && screenshotFiles.length > 0;

  return {
    pass,
    command: `node --input-type=module -e <playwright-replay-capture> ${targetUrl}`,
    dir: relative(cwd, replayDir),
    durationMs: Date.now() - startedAt,
    exitCode,
    stdout: compactText(result.stdout ?? ""),
    stderr: compactText(result.stderr ?? ""),
    files,
    videoFiles: videoFiles.map((file) => file.path),
    screenshotFiles: screenshotFiles.map((file) => file.path),
  };
}

function resolveFallbackUrl() {
  const candidates = fallbackUrlCandidates();
  const reachable = candidates.find(isUrlReachable);
  let server: ManagedExpectServer | null = null;
  if (!reachable) {
    const localCandidate = candidates.find(canAutoStartServer);
    if (localCandidate) {
      server = startManagedServer(localCandidate);
    }
  }
  const reachableAfterServer = reachable ?? candidates.find(isUrlReachable);
  return {
    url: reachableAfterServer ?? server?.url ?? candidates[0] ?? "",
    reachable: Boolean(reachableAfterServer),
    candidates,
    server,
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
  const fallbackUrl = resolveFallbackUrl();
  const commands: ReturnType<typeof runExpectCli>[] = [];
  try {
    if (!fallbackUrl.url) {
      return {
        pass: false,
        reason: "No fallback URL candidates were available for deterministic Expect CLI fallback.",
        url: null,
        candidates: [],
        server: fallbackUrl.server,
        commands,
      };
    }

    const open = runExpectCli(["exec", "expect", "open", "--browser", "chromium", "--wait-until", "load", fallbackUrl.url]);
    commands.push(open);
    if (!open.pass) {
      const replay = runReplayCapture(fallbackUrl.url);
      return {
        pass: false,
        reason: fallbackUrl.reachable ? "expect open failed" : "No probed fallback URL was reachable; attempted first candidate.",
        url: fallbackUrl.url,
        candidates: fallbackUrl.candidates,
        server: fallbackUrl.server,
        commands,
        replay,
      };
    }

    const reason = "AI TUI proof failed before useful steps; deterministic Expect CLI fallback executed.";
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

    const replay = runReplayCapture(fallbackUrl.url);

    return {
      pass: commands.every(item => item.pass) && replay.pass,
      reason,
      url: fallbackUrl.url,
      candidates: fallbackUrl.candidates,
      server: fallbackUrl.server,
      commands,
      replay,
    };
  } finally {
    stopManagedServer(fallbackUrl.server);
  }
}

if (forceFallback) {
  console.log("[expect-proof] EXPECT_FORCE_FALLBACK=1; running deterministic replay fallback without AI TUI.");
  const start = Date.now();
  const fallback = runFallbackProof();
  const pass = Boolean(fallback.pass);
  write({
    runAt: new Date().toISOString(),
    pass,
    skipped: false,
    required,
    agent: agent || null,
    target,
    url: url || null,
    durationMs: Date.now() - start,
    exitCode: pass ? 0 : 1,
    mode: "expect-cli-fallback-forced",
    stdout: "",
    stderr: "",
    tui: {
      pass: false,
      skipped: true,
      reason: "EXPECT_FORCE_FALLBACK=1",
    },
    fallback,
  });
  process.exit(pass ? 0 : 1);
}

console.log(`[expect-proof] pnpm ${args.join(" ")}`);
const start = Date.now();
const result = spawnSync("pnpm", args, {
  cwd,
  encoding: "utf-8",
  env: process.env,
  timeout: tuiTimeoutArg,
});

const exitCode = typeof result.status === "number" ? result.status : 1;
const tuiReport = extractExpectTuiReport(result.stdout ?? "");
const tuiTimedOut = Boolean(result.error && "code" in result.error && result.error.code === "ETIMEDOUT");
const fallback = exitCode !== 0 && fallbackEnabled && (tuiTimedOut || shouldRunExpectFallback(tuiReport, result.stdout ?? "", result.stderr ?? ""))
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
    processTimedOut: tuiTimedOut,
    processTimeoutMs: tuiTimeoutArg,
  },
  fallback,
};
write(payload);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(pass ? 0 : exitCode);
