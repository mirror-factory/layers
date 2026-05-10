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
  satisfied?: boolean;
  missingEvidence?: string[];
}

interface ResolvedFeature extends FeatureEntry {
  matchedPaths: string[];
}

const cwd = process.cwd();
const registryPath = join(cwd, ".ai-dev-kit", "registries", "feature-proof.json");
const outPath = join(cwd, ".evidence", "feature-proof-plan.json");
const args = new Set(process.argv.slice(2));
const enforceArtifacts = args.has("--enforce-artifacts");
const enforceLaneArg = process.argv.slice(2).find(arg => arg.startsWith("--enforce-lanes="));
const enforceLaneIds = enforceLaneArg
  ? new Set(enforceLaneArg.replace("--enforce-lanes=", "").split(",").map(id => id.trim()).filter(Boolean))
  : null;
const noWrite = args.has("--no-write");
const jsonOnly = args.has("--json");

function gitLines(args: string[]): string[] {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (result.status !== 0) return [];
  return result.stdout.split("\n").map(line => line.trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function changedFiles(): string[] {
  const explicit = process.env.FEATURE_PROOF_FILES ?? process.env.TICKET_FILES;
  if (explicit) {
    return unique(explicit.split(/[\n, ]+/).map(file => file.trim()).filter(Boolean));
  }

  return unique([
    ...gitLines(["diff", "--name-only"]),
    ...gitLines(["diff", "--name-only", "--cached"]),
    ...gitLines(["diff", "--name-only", "origin/development...HEAD"]),
    ...gitLines(["diff", "--name-only", "origin/main...HEAD"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"]),
  ]);
}

function readRegistry(): FeatureProofRegistry {
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

function evidenceSatisfied(lane: ProofLane): { satisfied: boolean; missingEvidence: string[] } {
  const evidence = lane.evidence ?? [];
  if (evidence.length === 0) return { satisfied: true, missingEvidence: [] };

  const missing: string[] = [];
  const invalid: string[] = [];
  let anyPresent = false;

  for (const rel of evidence) {
    const full = join(cwd, rel);
    if (!existsSync(full)) {
      missing.push(rel);
      continue;
    }

    anyPresent = true;
    try {
      const stat = statSync(full);
      if (stat.isFile() && rel.endsWith(".json")) {
        const parsed = JSON.parse(readFileSync(full, "utf-8")) as { pass?: boolean };
        if (parsed.pass === false) invalid.push(`${rel} (failed)`);
      }
    } catch {
      invalid.push(`${rel} (unreadable)`);
    }
  }

  return {
    satisfied: anyPresent && invalid.length === 0,
    missingEvidence: anyPresent ? invalid : missing,
  };
}

function main() {
  const registry = readRegistry();
  const files = changedFiles().filter(file => !ignored(file, registry));
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
    const artifactState = enforceArtifacts ? evidenceSatisfied(lane) : { satisfied: undefined, missingEvidence: [] };
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

  const missingArtifactLanes = enforceArtifacts
    ? requiredLanes.filter(lane => (enforceLaneIds === null || enforceLaneIds.has(lane.id)) && lane.satisfied === false)
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
    enforcedArtifactLanes: enforceArtifacts ? (enforceLaneIds ? [...enforceLaneIds].sort() : "all") : [],
    pass: !unregisteredBlocked && missingArtifactLanes.length === 0,
    blocked: {
      unregisteredUserFacingChange: unregisteredBlocked,
      missingArtifactLanes: missingArtifactLanes.map(lane => lane.id),
    },
  };

  if (!noWrite) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  }

  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[feature-proof] matched ${matchedFeatures.length} feature(s), required ${requiredLanes.length} proof lane(s)`);
    for (const feature of matchedFeatures) {
      console.log(`  - ${feature.id}: ${feature.proof.join(", ")} (${feature.matchedPaths.length} file(s))`);
    }
    if (unmatchedUserFacingFiles.length > 0) {
      console.log("[feature-proof] unregistered user-facing files:");
      for (const file of unmatchedUserFacingFiles) console.log(`  - ${file}`);
    }
    if (!noWrite) console.log(`[feature-proof] wrote ${outPath}`);
    if (missingArtifactLanes.length > 0) {
      console.log("[feature-proof] missing proof artifacts:");
      for (const lane of missingArtifactLanes) {
        console.log(`  - ${lane.id}: ${(lane.missingEvidence ?? []).join(", ") || "no evidence"}`);
      }
    }
  }

  if (!payload.pass) process.exit(1);
}

main();
