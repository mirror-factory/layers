#!/usr/bin/env tsx
/**
 * Records external native/device smoke proof into .evidence/native-smoke.json.
 *
 * This is the copy-back side of native:handoff. It intentionally requires a
 * real device/simulator identity plus screenshot and video evidence before a
 * passing native smoke claim can be written.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type JsonObject = Record<string, unknown>;
type Artifact = {
  path?: string;
  href?: string;
  bytes?: number;
  checksum?: string | null;
  label?: string;
};

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");
const out = join(evidenceDir, "native-smoke.json");

function readJson(path: string): JsonObject | null {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as JsonObject;
  } catch {
    return null;
  }
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function boolValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "pass", "passed", "green", "ready"].includes(normalized)) return true;
  if (["0", "false", "no", "fail", "failed", "blocked"].includes(normalized)) return false;
  return null;
}

function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => str(item)).filter(Boolean);
  return str(value)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function fromEnvOrInput(input: JsonObject, envName: string, inputName: string): string {
  return str(process.env[envName]) || str(input[inputName]);
}

function listFromEnvOrInput(input: JsonObject, envName: string, inputName: string): string[] {
  const env = arrayValue(process.env[envName]);
  return env.length ? env : arrayValue(input[inputName]);
}

function checksumFile(path: string, bytes: number): string | null {
  if (bytes > 128 * 1024 * 1024) return null;
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function artifactFor(value: string): Artifact {
  if (/^https?:\/\//i.test(value)) return { href: value };
  const full = join(cwd, value);
  if (!existsSync(full)) return { path: value };
  const stat = statSync(full);
  return {
    path: value,
    bytes: stat.size,
    checksum: checksumFile(full, stat.size),
  };
}

const inputPath = str(process.env.NATIVE_SMOKE_INPUT);
const input = inputPath ? readJson(join(cwd, inputPath)) ?? readJson(inputPath) ?? {} : {};
const requestedPass = boolValue(process.env.NATIVE_SMOKE_PASS) ?? boolValue(input.pass) ?? false;
const required = process.env.NATIVE_REQUIRED === "1" || input.required === true;
const platform = fromEnvOrInput(input, "NATIVE_SMOKE_PLATFORM", "platform");
const device = fromEnvOrInput(input, "NATIVE_SMOKE_DEVICE", "device");
const runner = fromEnvOrInput(input, "NATIVE_SMOKE_RUNNER", "runner");
const flowCommand = fromEnvOrInput(input, "NATIVE_SMOKE_FLOW", "flowCommand") || fromEnvOrInput(input, "NATIVE_SMOKE_COMMAND", "command");
const runUrl = fromEnvOrInput(input, "NATIVE_SMOKE_RUN_URL", "runUrl");
const notes = fromEnvOrInput(input, "NATIVE_SMOKE_NOTES", "notes");
const screenshots = listFromEnvOrInput(input, "NATIVE_SMOKE_SCREENSHOTS", "screenshots");
const videos = listFromEnvOrInput(input, "NATIVE_SMOKE_VIDEOS", "videos");
const logs = listFromEnvOrInput(input, "NATIVE_SMOKE_LOGS", "logs");
const artifacts = listFromEnvOrInput(input, "NATIVE_SMOKE_ARTIFACTS", "artifacts");
const branch = git(["branch", "--show-current"]) ?? str(process.env.GITHUB_HEAD_REF) ?? str(process.env.GITHUB_REF_NAME) ?? str(input.branch);
const commit = git(["rev-parse", "--short", "HEAD"]) ?? str(process.env.GITHUB_SHA).slice(0, 12) ?? str(input.commit);
const taskIds = unique([
  ...listFromEnvOrInput(input, "AI_DEV_KIT_TASK_IDS", "taskIds"),
  ...splitIds(process.env.SYMPHONY_TASK_IDS),
  process.env.AI_DEV_KIT_TASK_ID,
  process.env.LINEAR_TASK_ID,
  process.env.LINEAR_ISSUE_ID,
  process.env.LINEAR_IDENTIFIER,
  process.env.SYMPHONY_TASK_ID,
  process.env.SYMPHONY_TICKET_ID,
  process.env.TICKET_ID,
  process.env.ISSUE_ID,
  process.env.TASK_ID,
  ...(branch.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []),
]);

const missing: string[] = [];
if (requestedPass) {
  if (!platform) missing.push("NATIVE_SMOKE_PLATFORM or input.platform");
  if (!device) missing.push("NATIVE_SMOKE_DEVICE or input.device");
  if (!runner) missing.push("NATIVE_SMOKE_RUNNER or input.runner");
  if (!flowCommand) missing.push("NATIVE_SMOKE_FLOW or input.flowCommand");
  if (!screenshots.length) missing.push("NATIVE_SMOKE_SCREENSHOTS or input.screenshots");
  if (!videos.length) missing.push("NATIVE_SMOKE_VIDEOS or input.videos");
  if (!runUrl && !logs.length && !artifacts.length) missing.push("NATIVE_SMOKE_RUN_URL, logs, or artifacts");
}

const pass = requestedPass && missing.length === 0;
const state = pass ? "green" : requestedPass ? "blocked" : "failed";
const payload = {
  runAt: new Date().toISOString(),
  pass,
  status: state,
  skipped: false,
  required,
  source: "native-smoke-record",
  state,
  taskIds,
  branch,
  commit,
  platform,
  device,
  runner,
  flowCommand,
  runUrl,
  screenshots: screenshots.map(artifactFor),
  videos: videos.map(artifactFor),
  logs: logs.map(artifactFor),
  artifacts: artifacts.map(artifactFor),
  notes,
  missing,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[native-smoke-record] wrote ${out}`);

if (!pass) {
  if (missing.length) console.error(`[native-smoke-record] missing required proof field(s): ${missing.join(", ")}`);
  process.exit(required || requestedPass ? 1 : 0);
}
