#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");
const profilePath = join(cwd, ".ai-dev-kit/project-profile.json");
const required = process.env.NATIVE_REQUIRED === "1";
const shouldRun = process.env.NATIVE_BUILD_RUN === "1";

function write(payload: Record<string, unknown>) {
  mkdirSync(evidenceDir, { recursive: true });
  const out = join(evidenceDir, "native-build.json");
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[native-build] wrote ${out}`);
}

function enabledNativePlatforms(): string[] {
  if (!existsSync(profilePath)) return [];
  const profile = JSON.parse(readFileSync(profilePath, "utf-8")) as {
    platforms?: Record<string, { enabled?: boolean }>;
  };
  return Object.entries(profile.platforms ?? {})
    .filter(([name, platform]) => platform.enabled && ["ios", "android", "macos", "windows"].includes(name))
    .map(([name]) => name);
}

const platforms = enabledNativePlatforms();
if (platforms.length === 0) {
  write({
    runAt: new Date().toISOString(),
    pass: true,
    skipped: true,
    reason: "No native platforms enabled in .ai-dev-kit/project-profile.json.",
  });
  process.exit(0);
}

const commands = [
  process.env.WEB_BUILD_COMMAND,
  process.env.IOS_BUILD_COMMAND,
  process.env.ANDROID_BUILD_COMMAND,
  process.env.DESKTOP_BUILD_COMMAND,
].filter(Boolean) as string[];

if (!shouldRun || commands.length === 0) {
  write({
    runAt: new Date().toISOString(),
    pass: !required,
    skipped: true,
    required,
    platforms,
    reason: shouldRun
      ? "No WEB_BUILD_COMMAND, IOS_BUILD_COMMAND, ANDROID_BUILD_COMMAND, or DESKTOP_BUILD_COMMAND was provided."
      : "NATIVE_BUILD_RUN is not set to 1.",
  });
  if (required) process.exit(1);
  process.exit(0);
}

const results = [];
let failed = false;
for (const command of commands) {
  const start = Date.now();
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: "utf-8",
    env: process.env,
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  if (exitCode !== 0) failed = true;
  results.push({
    command,
    exitCode,
    durationMs: Date.now() - start,
    stdout: result.stdout.slice(-10_000),
    stderr: result.stderr.slice(-10_000),
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

write({
  runAt: new Date().toISOString(),
  pass: !failed,
  skipped: false,
  required,
  platforms,
  results,
});

process.exit(failed ? 1 : 0);
