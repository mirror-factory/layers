#!/usr/bin/env tsx
/**
 * Resolve required proof lanes for the current ticket.
 *
 * The feature proof registry is the bridge between "what changed" and "what
 * proof is mandatory". It lets Symphony, CI, DevKit, and Linear use the same
 * deterministic policy instead of relying on an agent to choose tests.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

interface ProofLane {
  label: string;
  command: string;
  evidence?: string[];
  description?: string;
}

interface FeatureEntry {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
  userFacing: boolean;
  surfaces: string[];
  routes?: string[];
  paths: string[];
  proof: string[];
  tests?: Record<string, string[]>;
  notes?: string[];
}

interface FeatureProofRegistry {
  kind: "feature-proof-registry";
  schema_version: number;
  policy: {
    requireRegistryForUserFacingChanges: boolean;
    expectPolicy: string;
    defaultUserFacingProof?: string[];
    defaultNativeProof?: string[];
  };
  ignoredPaths?: string[];
  proofLanes: Record<string, ProofLane>;
  features: FeatureEntry[];
}

interface ResolvedLane extends ProofLane {
  id: string;
  satisfied?: boolean | null;
  missingEvidence?: string[];
}

interface ResolvedFeature extends FeatureEntry {
  matchedPaths: string[];
}

type FeatureProofPayload = ReturnType<typeof resolveFeatureProof>;

interface ResolveOptions {
  root?: string;
  files?: string[];
  enforceArtifacts?: boolean;
  enforceLaneIds?: Set<string> | null;
  write?: boolean;
}

function gitLines(args: string[], root: string): string[] {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  if (result.status !== 0) return [];
  return result.stdout.split("\n").map(line => line.trim()).filter(Boolean);
}

function gitOk(args: string[], root: string): boolean {
  return spawnSync("git", args, { cwd: root, encoding: "utf-8" }).status === 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function changedFiles(root: string): string[] {
  const explicit = process.env.FEATURE_PROOF_FILES ?? process.env.TICKET_FILES;
  if (explicit) {
    return unique(explicit.split(/[\n, ]+/).map(file => file.trim()).filter(Boolean));
  }

  const workingTreeFiles = [
    ...gitLines(["diff", "--name-only"], root),
    ...gitLines(["diff", "--name-only", "--cached"], root),
    ...gitLines(["ls-files", "--others", "--exclude-standard"], root),
  ];
  const upstream = gitLines(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], root)[0];
  const branchBases = unique([
    upstream,
    gitOk(["rev-parse", "--verify", "origin/development"], root) ? "origin/development" : "",
  ].filter(Boolean));

  const branchFiles = branchBases.length > 0
    ? branchBases.flatMap(ref => gitLines(["diff", "--name-only", `${ref}...HEAD`], root))
    : gitLines(["diff", "--name-only", "origin/main...HEAD"], root);

  return unique([...workingTreeFiles, ...branchFiles]);
}

function readRegistry(root: string): FeatureProofRegistry {
  const registryPath = join(root, ".ai-dev-kit", "registries", "feature-proof.json");
  if (!existsSync(registryPath)) {
    throw new Error(`Missing feature proof registry: ${registryPath}`);
  }
  const registry = JSON.parse(readFileSync(registryPath, "utf-8")) as FeatureProofRegistry;
  if (registry.kind !== "feature-proof-registry") {
    throw new Error(`Invalid feature proof registry kind: ${String((registry as { kind?: unknown }).kind)}`);
  }
  return registry;
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const file = normalizePath(filePath);
  const rule = normalizePath(pattern);

  if (rule.endsWith("/**")) {
    const prefix = rule.slice(0, -3);
    return file === prefix || file.startsWith(`${prefix}/`);
  }

  if (!rule.includes("*")) {
    return file === rule;
  }

  const token = "\u0000";
  const patternRegex = escapeRegex(rule.replaceAll("**", token))
    .replaceAll("\\*", "[^/]*")
    .replaceAll(token, ".*");
  return new RegExp(`^${patternRegex}$`).test(file);
}

function ignored(file: string, registry: FeatureProofRegistry): boolean {
  return (registry.ignoredPaths ?? []).some(pattern => matchesPattern(file, pattern));
}

function looksUserFacing(file: string): boolean {
  if (file.startsWith("app/api/")) return false;
  if (file.startsWith("app/dev-kit/")) return true;
  if (file.startsWith("app/") && /\.(tsx|css)$/.test(file)) return true;
  if (file.startsWith("components/") && /\.(tsx|css)$/.test(file)) return true;
  if (file.startsWith("styles/") || file === "app/globals.css") return true;
  if (file.startsWith("public/") && /\.(css|png|jpg|jpeg|webp|svg)$/.test(file)) return true;
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function releaseArtifactReady(payload: Record<string, unknown>): boolean {
  const statusText = [
    stringField(payload, "status"),
    stringField(payload, "releaseStatus"),
    stringField(payload, "uploadStatus"),
  ].filter(Boolean).join(" ").toLowerCase();
  return payload.signed === true
    || payload.notarized === true
    || payload.releaseReady === true
    || payload.storeUpload === true
    || /\b(signed|notarized|uploaded|release-ready|green)\b/.test(statusText);
}

function releaseEvidenceIssue(rel: string, payload: Record<string, unknown>): { failed?: string; pending?: string } {
  if (!rel.endsWith("release-artifacts.json")) return {};

  const status = stringField(payload, "status").toLowerCase();
  if (status === "blocked" || status === "fail" || payload.pass === false) {
    return { failed: `${rel} (${status || "failed"})` };
  }
  if (status === "pending" || payload.skipped === true) {
    return { pending: `${rel} (pending signed/notarized/uploaded release proof)` };
  }
  if (payload.pass === true || status === "ready" || status === "pass" || status === "green" || status === "release-ready") {
    return releaseArtifactReady(payload) ? {} : { pending: `${rel} (pending signed/notarized/uploaded release proof)` };
  }

  return {};
}

function evidenceState(lane: ProofLane, root: string): { satisfied: boolean | null; missingEvidence: string[] } {
  const evidence = lane.evidence ?? [];
  if (evidence.length === 0) return { satisfied: true, missingEvidence: [] };

  const missing: string[] = [];
  const invalid: string[] = [];
  const pending: string[] = [];
  let anyPresent = false;

  for (const rel of evidence) {
    const full = join(root, rel);
    if (!existsSync(full)) {
      missing.push(rel);
      continue;
    }

    anyPresent = true;
    try {
      const stat = statSync(full);
      if (stat.isFile() && rel.endsWith(".json")) {
        const parsed = JSON.parse(readFileSync(full, "utf-8")) as unknown;
        if (!isRecord(parsed)) {
          invalid.push(`${rel} (invalid)`);
          continue;
        }
        const releaseIssue = releaseEvidenceIssue(rel, parsed);
        if (releaseIssue.failed) invalid.push(releaseIssue.failed);
        if (releaseIssue.pending) pending.push(releaseIssue.pending);
        if (!releaseIssue.failed && parsed.pass === false) invalid.push(`${rel} (failed)`);
      }
    } catch {
      invalid.push(`${rel} (unreadable)`);
    }
  }

  if (invalid.length > 0) return { satisfied: false, missingEvidence: invalid };
  if (pending.length > 0) return { satisfied: null, missingEvidence: pending };
  if (anyPresent) return { satisfied: true, missingEvidence: [] };

  return { satisfied: null, missingEvidence: missing };
}

export function resolveFeatureProof(options: ResolveOptions = {}) {
  const root = options.root ?? process.cwd();
  const registry = readRegistry(root);
  const files = (options.files ?? changedFiles(root)).filter(file => !ignored(file, registry));
  const matchedFeatures: ResolvedFeature[] = [];
  const matchedFileSet = new Set<string>();

  for (const feature of registry.features) {
    const matchedPaths = files.filter(file => feature.paths.some(pattern => matchesPattern(file, pattern)));
    if (matchedPaths.length === 0) continue;
    matchedPaths.forEach(file => matchedFileSet.add(file));
    matchedFeatures.push({ ...feature, matchedPaths });
  }

  const unmatchedUserFacingFiles = files.filter(file => !matchedFileSet.has(file) && looksUserFacing(file));
  const requiredLaneIds = unique(matchedFeatures.flatMap(feature => feature.proof));
  const requiredLanes: ResolvedLane[] = requiredLaneIds.map(id => {
    const lane = registry.proofLanes[id] ?? {
      label: id,
      command: `No command registered for proof lane ${id}`,
      evidence: [],
    };
    const artifactState = evidenceState(lane, root);
    return {
      id,
      ...lane,
      ...artifactState,
    };
  });

  const unregisteredBlocked =
    registry.policy.requireRegistryForUserFacingChanges &&
    unmatchedUserFacingFiles.length > 0 &&
    process.env.FEATURE_PROOF_ALLOW_UNREGISTERED !== "1";

  const missingArtifactLanes = options.enforceArtifacts
    ? requiredLanes.filter(lane => (options.enforceLaneIds === null || options.enforceLaneIds === undefined || options.enforceLaneIds.has(lane.id)) && lane.satisfied !== true)
    : [];

  const payload = {
    generatedAt: new Date().toISOString(),
    registryPath: ".ai-dev-kit/registries/feature-proof.json",
    policy: registry.policy,
    changedFiles: files,
    matchedFeatures,
    unmatchedUserFacingFiles,
    requiredLanes,
    commands: requiredLanes.map(lane => lane.command),
    enforcedArtifactLanes: options.enforceArtifacts ? (options.enforceLaneIds ? [...options.enforceLaneIds].sort() : "all") : [],
    pass: !unregisteredBlocked && missingArtifactLanes.length === 0,
    blocked: {
      unregisteredUserFacingChange: unregisteredBlocked,
      missingArtifactLanes: missingArtifactLanes.map(lane => lane.id),
    },
  };

  if (options.write !== false) {
    const outPath = join(root, ".evidence", "feature-proof-plan.json");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  }

  return payload;
}

function printPayload(payload: FeatureProofPayload, root: string, jsonOnly: boolean, noWrite: boolean) {
  const outPath = join(root, ".evidence", "feature-proof-plan.json");

  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[feature-proof] matched ${payload.matchedFeatures.length} feature(s), required ${payload.requiredLanes.length} proof lane(s)`);
    for (const feature of payload.matchedFeatures) {
      console.log(`  - ${feature.id}: ${feature.proof.join(", ")} (${feature.matchedPaths.length} file(s))`);
    }
    if (payload.unmatchedUserFacingFiles.length > 0) {
      console.log("[feature-proof] unregistered user-facing files:");
      for (const file of payload.unmatchedUserFacingFiles) console.log(`  - ${file}`);
    }
    if (!noWrite) console.log(`[feature-proof] wrote ${outPath}`);
    if (payload.blocked.missingArtifactLanes.length > 0) {
      console.log("[feature-proof] missing proof artifacts:");
      for (const lane of payload.requiredLanes.filter(item => payload.blocked.missingArtifactLanes.includes(item.id))) {
        console.log(`  - ${lane.id}: ${(lane.missingEvidence ?? []).join(", ") || "no evidence"}`);
      }
    }
  }
}

function main() {
  const rawArgs = process.argv.slice(2);
  const args = new Set(rawArgs);
  const rootArg = rawArgs.find(arg => arg.startsWith("--root="));
  const root = rootArg ? rootArg.replace("--root=", "") : process.cwd();
  const enforceLaneArg = rawArgs.find(arg => arg.startsWith("--enforce-lanes="));
  const enforceLaneIds = enforceLaneArg
    ? new Set(enforceLaneArg.replace("--enforce-lanes=", "").split(",").map(id => id.trim()).filter(Boolean))
    : null;
  const noWrite = args.has("--no-write");
  const payload = resolveFeatureProof({
    root,
    enforceArtifacts: args.has("--enforce-artifacts"),
    enforceLaneIds,
    write: !noWrite,
  });

  printPayload(payload, root, args.has("--json"), noWrite);

  if (!payload.pass) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
