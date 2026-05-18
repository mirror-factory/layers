#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");
const profilePath = join(cwd, ".ai-dev-kit/project-profile.json");
const required = process.env.NATIVE_REQUIRED === "1";
const shouldRun = process.env.MAESTRO_RUN === "1";

function write(payload: Record<string, unknown>) {
  mkdirSync(evidenceDir, { recursive: true });
  const out = join(evidenceDir, "native-smoke.json");
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[native-smoke] wrote ${out}`);
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

if (!existsSync(join(cwd, ".maestro"))) {
  write({
    runAt: new Date().toISOString(),
    pass: !required,
    skipped: true,
    required,
    platforms,
    reason: "Native platforms are enabled, but .maestro flows are not installed yet.",
  });
  if (required) process.exit(1);
  process.exit(0);
}

if (!shouldRun) {
  write({
    runAt: new Date().toISOString(),
    pass: !required,
    skipped: true,
    required,
    platforms,
    reason: "MAESTRO_RUN is not set to 1.",
  });
  if (required) process.exit(1);
  process.exit(0);
}

const version = spawnSync("maestro", ["--version"], { cwd, encoding: "utf-8" });
if (version.status !== 0) {
  write({
    runAt: new Date().toISOString(),
    pass: !required,
    skipped: true,
    required,
    platforms,
    reason: "maestro CLI is not installed on this machine.",
    stderr: version.stderr?.slice(-4000),
  });
  if (required) process.exit(1);
  process.exit(0);
}

const start = Date.now();
const result = spawnSync("maestro", ["test", ".maestro"], {
  cwd,
  encoding: "utf-8",
  env: {
    ...process.env,
    MAESTRO_APP_ID: process.env.MAESTRO_APP_ID ?? "com.mirafactory.layers",
    MAESTRO_HOME_TEXT: process.env.MAESTRO_HOME_TEXT ?? "Layers",
  },
});
const exitCode = typeof result.status === "number" ? result.status : 1;

write({
  runAt: new Date().toISOString(),
  pass: exitCode === 0,
  skipped: false,
  required,
  platforms,
  durationMs: Date.now() - start,
  exitCode,
  stdout: result.stdout.slice(-20_000),
  stderr: result.stderr.slice(-20_000),
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(exitCode);
