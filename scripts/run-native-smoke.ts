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

function skippedPayload(reason: string, extra: Record<string, unknown> = {}) {
  const blocked = required;
  return {
    runAt: new Date().toISOString(),
    pass: false,
    nativeProofSatisfied: false,
    status: blocked ? "blocked" : "pending",
    state: blocked ? "blocked" : "pending",
    skipped: true,
    required,
    reason,
    proofBoundary: "Skipped native smoke is coordination evidence only. It does not satisfy native/device proof until a real simulator, device, or device-cloud run records device identity, screenshot, video, and a run URL or logs.",
    ...extra,
  };
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
    nativeProofSatisfied: false,
    status: "not-applicable",
    state: "not-applicable",
    skipped: true,
    required: false,
    reason: "No native platforms enabled in .ai-dev-kit/project-profile.json.",
    proofBoundary: "No native proof is required because this project profile has no enabled native platforms.",
  });
  process.exit(0);
}

if (!existsSync(join(cwd, ".maestro"))) {
  write(skippedPayload("Native platforms are enabled, but .maestro flows are not installed yet.", {
    platforms,
  }));
  if (required) process.exit(1);
  process.exit(0);
}

if (!shouldRun) {
  write(skippedPayload("MAESTRO_RUN is not set to 1.", {
    platforms,
  }));
  if (required) process.exit(1);
  process.exit(0);
}

const version = spawnSync("maestro", ["--version"], { cwd, encoding: "utf-8" });
if (version.status !== 0) {
  write(skippedPayload("maestro CLI is not installed on this machine.", {
    platforms,
    stderr: version.stderr?.slice(-4000),
  }));
  if (required) process.exit(1);
  process.exit(0);
}

const start = Date.now();
const result = spawnSync("maestro", ["test", ".maestro"], {
  cwd,
  encoding: "utf-8",
  env: {
    ...process.env,
    MAESTRO_APP_ID: process.env.MAESTRO_APP_ID ?? "com.mirrorfactory.layers",
    MAESTRO_HOME_TEXT: process.env.MAESTRO_HOME_TEXT ?? "Layers",
  },
});
const exitCode = typeof result.status === "number" ? result.status : 1;

write({
  runAt: new Date().toISOString(),
  pass: exitCode === 0,
  nativeProofSatisfied: exitCode === 0,
  status: exitCode === 0 ? "passed" : "failed",
  state: exitCode === 0 ? "green" : "failed",
  skipped: false,
  required,
  platforms,
  durationMs: Date.now() - start,
  exitCode,
  stdout: result.stdout.slice(-20_000),
  stderr: result.stderr.slice(-20_000),
  proofBoundary: "This is direct native smoke proof only when Maestro ran against an installed app on a real device, simulator, emulator, or approved device-cloud session.",
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(exitCode);
