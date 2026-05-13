#!/usr/bin/env tsx
/**
 * Builds a reviewer-facing index for native/release evidence artifacts.
 *
 * The index is intentionally explicit about proof boundaries so blocked
 * readiness scans and failed emulator attempts cannot be mistaken for green
 * native/device proof.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type JsonObject = Record<string, unknown>;

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");
const out = join(evidenceDir, "native-evidence-index.json");

const entries = [
  {
    id: "runner-capability",
    path: ".evidence/runner-capability.json",
    command: "pnpm runner:doctor",
    proves: "Which proof lanes this machine can run.",
    boundary: "Readiness evidence only; it does not prove app runtime behavior.",
  },
  {
    id: "native-provider-readiness",
    path: ".evidence/native-provider-readiness.json",
    command: "pnpm native:providers",
    proves: "Which local, Mac, Android, and cloud native proof providers are ready or blocked.",
    boundary: "Provider readiness only; native/device proof still requires native-smoke.json with media.",
  },
  {
    id: "native-config",
    path: ".evidence/native-config.json",
    command: "pnpm test:native:config",
    proves: "Capacitor, bundle ID, Android namespace, OAuth callback, and release config are declared.",
    boundary: "Static config only; it does not prove install, launch, OAuth return, safe area, or device behavior.",
  },
  {
    id: "native-build",
    path: ".evidence/native-build.json",
    command: "NATIVE_BUILD_RUN=1 pnpm build:native",
    proves: "Configured native build command result and generated native artifact paths.",
    boundary: "Build evidence only; it does not prove runtime or production release approval.",
  },
  {
    id: "native-smoke",
    path: ".evidence/native-smoke.json",
    command: "MAESTRO_RUN=1 pnpm test:native:smoke or pnpm native:record-smoke",
    proves: "Native runtime proof only when it records device identity, screenshot, video, flow command, and run URL/logs.",
    boundary: "Skipped or blocked native-smoke files are not passing proof.",
  },
  {
    id: "android-emulator-attempt",
    path: ".evidence/android-emulator-proof/attempt.json",
    command: "Android emulator attempt on CT100",
    proves: "Why the local CT100 emulator path did or did not boot.",
    boundary: "Blocked attempt evidence only; it never satisfies native/device proof unless the attempt records a booted device and smoke media.",
  },
  {
    id: "release-artifacts",
    path: ".evidence/release-artifacts.json",
    command: "pnpm build:release",
    proves: "Reviewable, signed, notarized, uploaded, or production release artifact status.",
    boundary: "Artifact discovery alone is not release readiness. Reviewable internal artifacts are not production approval.",
  },
  {
    id: "native-device-handoff",
    path: ".evidence/native-device-handoff.json",
    command: "pnpm native:handoff",
    proves: "Copy-back commands and runner options for closing native/device proof.",
    boundary: "Coordination evidence only; it does not close native/device lanes by itself.",
  },
  {
    id: "proof-packet",
    path: ".evidence/proof-packet.json",
    command: "pnpm test:proof",
    proves: "Aggregated evidence packet for dashboard indexing.",
    boundary: "Aggregation only; each lane still depends on its source artifact status.",
  },
];

function readJson(relPath: string): JsonObject | null {
  const full = join(cwd, relPath);
  if (!existsSync(full)) return null;
  try {
    return JSON.parse(readFileSync(full, "utf-8")) as JsonObject;
  } catch {
    return null;
  }
}

function checksum(fullPath: string, bytes: number): string | null {
  if (bytes > 128 * 1024 * 1024) return null;
  return `sha256:${createHash("sha256").update(readFileSync(fullPath)).digest("hex")}`;
}

function statusFor(payload: JsonObject | null): string {
  if (!payload) return "missing";
  const raw = typeof payload.status === "string" ? payload.status : typeof payload.state === "string" ? payload.state : "";
  if (payload.skipped === true) return raw && raw !== "green" ? raw : "pending";
  if (raw) return raw;
  if (payload.pass === true) return "present";
  if (payload.pass === false) return "failed";
  return "present";
}

function proofSatisfied(payload: JsonObject | null): boolean {
  if (!payload || payload.pass !== true || payload.skipped === true) return false;
  if (payload.nativeProofSatisfied === true || payload.releaseProofSatisfied === true) return true;
  const status = statusFor(payload);
  return ["passed", "release-ready", "reviewable-internal-artifact", "green"].includes(status);
}

const indexed = entries.map((entry) => {
  const full = join(cwd, entry.path);
  const payload = readJson(entry.path);
  const stat = existsSync(full) ? statSync(full) : null;
  return {
    ...entry,
    present: Boolean(stat),
    status: statusFor(payload),
    pass: payload?.pass ?? null,
    skipped: payload?.skipped ?? null,
    proofSatisfied: proofSatisfied(payload),
    bytes: stat?.size ?? null,
    modifiedAt: stat?.mtime.toISOString() ?? null,
    checksum: stat ? checksum(full, stat.size) : null,
    runAt: typeof payload?.runAt === "string" ? payload.runAt : typeof payload?.generatedAt === "string" ? payload.generatedAt : null,
    sourceBoundary: typeof payload?.proofBoundary === "string" ? payload.proofBoundary : null,
  };
});

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: indexed.some((entry) => entry.id === "native-smoke" && entry.proofSatisfied) ? "native-proof-present" : "native-proof-pending",
  proofBoundary: "This index makes evidence discoverable. It does not convert readiness, skipped, blocked, or handoff artifacts into native/device proof.",
  commands: indexed.map(({ id, command, path }) => ({ id, command, path })),
  entries: indexed,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[native-evidence-index] wrote ${out}`);
