#!/usr/bin/env tsx
/**
 * Final done-state proof gate.
 *
 * Feature-proof planning can run early and report pending lanes. This gate is
 * different: Symphony, PR handoff, or a human runs it only when a ticket is
 * supposed to be done. At that point every mapped lane must be green.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Lane {
  id: string;
  label?: string;
  satisfied?: boolean | null;
  missingEvidence?: string[];
}

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");
const planPath = join(evidenceDir, "feature-proof-plan.json");

function fail(message: string): never {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, "done-proof.json"), JSON.stringify({
    runAt: new Date().toISOString(),
    pass: false,
    reason: message,
  }, null, 2) + "\n");
  console.error(`[done-proof] BLOCKED: ${message}`);
  process.exit(1);
}

if (!existsSync(planPath)) {
  fail("missing .evidence/feature-proof-plan.json; run pnpm test:feature-proof first");
}

const plan = JSON.parse(readFileSync(planPath, "utf-8")) as {
  pass?: boolean;
  matchedFeatures?: Array<{ id: string; name?: string; userFacing?: boolean; proof?: string[] }>;
  requiredLanes?: Lane[];
  unmatchedUserFacingFiles?: string[];
  blocked?: {
    unregisteredUserFacingChange?: boolean;
    missingArtifactLanes?: string[];
  };
};

const matchedFeatures = plan.matchedFeatures ?? [];
const requiredLanes = plan.requiredLanes ?? [];
const missing = requiredLanes.filter((lane) => lane.satisfied !== true);
const unregistered = plan.unmatchedUserFacingFiles ?? [];
const pass = unregistered.length === 0 && missing.length === 0 && plan.blocked?.unregisteredUserFacingChange !== true;

const payload = {
  runAt: new Date().toISOString(),
  pass,
  matchedFeatureCount: matchedFeatures.length,
  requiredLaneCount: requiredLanes.length,
  missingLaneCount: missing.length,
  unregisteredUserFacingFiles: unregistered,
  missingLanes: missing.map((lane) => ({
    id: lane.id,
    label: lane.label ?? lane.id,
    missingEvidence: lane.missingEvidence ?? [],
  })),
};

mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, "done-proof.json"), JSON.stringify(payload, null, 2) + "\n");

if (!pass) {
  for (const lane of payload.missingLanes) {
    console.error(`[done-proof] missing ${lane.id}: ${lane.missingEvidence.join(", ") || "no green evidence"}`);
  }
  for (const file of unregistered) {
    console.error(`[done-proof] unregistered user-facing file: ${file}`);
  }
  console.error("[done-proof] BLOCKED: all mapped proof lanes must be green before this ticket is done.");
  process.exit(1);
}

console.log(`[done-proof] PASS ${requiredLanes.length} mapped proof lane(s) green for ${matchedFeatures.length} feature(s).`);
