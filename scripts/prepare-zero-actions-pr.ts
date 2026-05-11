#!/usr/bin/env tsx
/**
 * Prepare a no-hosted-Actions handoff packet.
 *
 * This script does not push. It verifies that local proof exists, writes a PR
 * body and JSON manifest, and prints the explicit commands a human/operator can
 * choose later. That keeps GitHub-hosted Actions at $0 while still making the
 * local proof auditable.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");

function git(args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function workflowFiles(): string[] {
  const dir = join(cwd, ".github", "workflows");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((file) => /\.(ya?ml)$/.test(file)).sort();
}

function baseBranch(): string {
  for (const candidate of ["origin/development", "origin/dev", "origin/main"]) {
    const result = spawnSync("git", ["rev-parse", "--verify", candidate], { cwd, stdio: "ignore" });
    if (result.status === 0) return candidate;
  }
  return "origin/main";
}

function changedFiles(base: string): string[] {
  const out = git(["diff", "--name-only", `${base}...HEAD`]);
  return out ? out.split("\n").filter(Boolean) : [];
}

function hasSkipCi(message: string): boolean {
  return /\[(?:skip ci|ci skip|no ci|skip actions|actions skip)\]/i.test(message);
}

mkdirSync(evidenceDir, { recursive: true });

const base = baseBranch();
const proofPacketPath = join(evidenceDir, "proof-packet.json");
const proofPacket = readJson(proofPacketPath);
const latestTier = readJson(join(evidenceDir, "tier-latest.json"));
const tier0 = readJson(join(evidenceDir, "tier-0.json"));
const tier1 = readJson(join(evidenceDir, "tier-1.json"));
const tier2 = readJson(join(evidenceDir, "tier-2.json"));
const tier3 = readJson(join(evidenceDir, "tier-3.json"));
const expectProof = readJson(join(evidenceDir, "expect-proof.json"));
const featureProof = readJson(join(evidenceDir, "feature-proof-plan.json"));
const headMessage = git(["log", "-1", "--pretty=%B"]);
const workflows = workflowFiles();
const branch = git(["branch", "--show-current"]);
const head = git(["rev-parse", "--short", "HEAD"]);
const status = git(["status", "--short"]);
const files = changedFiles(base);
const skipCi = hasSkipCi(headMessage);
const packetPass = Boolean(proofPacket && typeof proofPacket === "object");
const latestTierPass = latestTier?.pass === true || latestTier?.status === "pass";
const tierPass = (tier: Record<string, unknown> | null) => tier?.pass === true || tier?.status === "pass";
const expectPass = !expectProof || expectProof.pass === true || expectProof.skipped === true;
const doneProof = readJson(join(evidenceDir, "done-proof.json"));
const doneProofPass = doneProof?.pass === true;
const requiredLaneIds = Array.isArray(featureProof?.requiredLanes)
  ? featureProof.requiredLanes
      .map((lane) => lane && typeof lane === "object" && "id" in lane ? String((lane as { id?: unknown }).id ?? "") : "")
      .filter(Boolean)
  : [];
const requiresTier3 = requiredLaneIds.some((id) => id === "visual-video" || id === "expect");

const warnings: string[] = [];
if (!packetPass) warnings.push("missing .evidence/proof-packet.json; run pnpm test:proof");
if (!latestTierPass) warnings.push("latest tier evidence is not green; run the required pnpm verify:tier commands");
if (!tierPass(tier0)) warnings.push("Tier 0 evidence is missing or not green; run pnpm verify:tier 0");
if (!tierPass(tier1)) warnings.push("Tier 1 evidence is missing or not green; run pnpm verify:tier 1");
if (requiresTier3 && !tierPass(tier3)) warnings.push("Tier 3 evidence is required by mapped UI lanes and is missing or not green; run pnpm verify:tier 3");
if (!expectPass) warnings.push(".evidence/expect-proof.json is present but not green/skipped");
if (!doneProofPass) warnings.push("all mapped proof lanes are not confirmed green; run pnpm test:done after required tiers");
if (workflows.length > 0 && !skipCi) warnings.push("HEAD commit does not include [skip ci]; pushing this branch can trigger GitHub-hosted Actions");
if (status) warnings.push("working tree is dirty; commit or intentionally include the dirty proof state before PR handoff");

const manifest = {
  generatedAt: new Date().toISOString(),
  branch,
  base,
  head,
  changedFiles: files,
  workflows,
  hostedActionsRisk: workflows.length > 0 && !skipCi ? "high" : "skip-ci-present",
  localProof: {
    proofPacket: existsSync(proofPacketPath) ? ".evidence/proof-packet.json" : null,
    tierLatest: existsSync(join(evidenceDir, "tier-latest.json")) ? ".evidence/tier-latest.json" : null,
    tier0: existsSync(join(evidenceDir, "tier-0.json")) ? ".evidence/tier-0.json" : null,
    tier1: existsSync(join(evidenceDir, "tier-1.json")) ? ".evidence/tier-1.json" : null,
    tier2: existsSync(join(evidenceDir, "tier-2.json")) ? ".evidence/tier-2.json" : null,
    tier3: existsSync(join(evidenceDir, "tier-3.json")) ? ".evidence/tier-3.json" : null,
    featureProof: existsSync(join(evidenceDir, "feature-proof-plan.json")) ? ".evidence/feature-proof-plan.json" : null,
    expectProof: existsSync(join(evidenceDir, "expect-proof.json")) ? ".evidence/expect-proof.json" : null,
    criticalCoverage: existsSync(join(evidenceDir, "critical-coverage.json")) ? ".evidence/critical-coverage.json" : null,
    doneProof: existsSync(join(evidenceDir, "done-proof.json")) ? ".evidence/done-proof.json" : null,
  },
  warnings,
};

const body = `## Local Proof PR Handoff

Base: \`${base.replace(/^origin\//, "")}\`
Branch: \`${branch}\`
Head: \`${head}\`

### Local proof artifacts

- Proof packet: \`.evidence/proof-packet.json\`
- Feature proof: \`.evidence/feature-proof-plan.json\`
- Expect proof: \`.evidence/expect-proof.json\`
- Critical coverage: \`.evidence/critical-coverage.json\`

### GitHub Actions policy

This PR is prepared for a zero-hosted-Actions budget. The repository has ${workflows.length} workflow file(s): ${workflows.length ? workflows.map((file) => `\`${file}\``).join(", ") : "none"}.

${skipCi ? "The HEAD commit contains a skip-CI marker." : "The HEAD commit does not contain a skip-CI marker. Do not push this exact branch if hosted Actions must remain at zero."}

### Required local verification before merge

- \`pnpm verify:tier 0\`
- \`pnpm verify:tier 1\`
- \`pnpm verify:tier 2\` for ticket proof
- \`EXPECT_RUN=1 EXPECT_REQUIRED=1 pnpm test:expect\` when feature proof requires Expect
- \`pnpm verify:tier 3\` for user-facing visual/media proof
- \`pnpm test:proof\`

### Warnings

${warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "- none"}
`;

const manifestPath = join(evidenceDir, "zero-actions-pr.json");
const bodyPath = join(evidenceDir, "zero-actions-pr-body.md");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(bodyPath, body);

console.log(`[zero-actions-pr] wrote ${manifestPath}`);
console.log(`[zero-actions-pr] wrote ${bodyPath}`);
console.log("");
console.log("[zero-actions-pr] recommended push strategy when hosted Actions must stay at $0:");
console.log("  1. Squash/recommit the final branch with a HEAD commit message containing [skip ci].");
console.log("  2. Push only that prepared branch.");
console.log("  3. Create a draft PR with --body-file .evidence/zero-actions-pr-body.md.");
console.log("  4. Do not treat skipped GitHub checks as proof; use the attached local proof packet.");
console.log("");

if (warnings.length > 0) {
  console.error("[zero-actions-pr] warnings present; review .evidence/zero-actions-pr.json before pushing.");
  process.exit(1);
}
