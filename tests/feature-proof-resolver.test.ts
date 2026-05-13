import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveFeatureProof } from "../scripts/resolve-feature-proof";

function writeFixtureProject(dir: string) {
  mkdirSync(join(dir, ".ai-dev-kit/registries"), { recursive: true });
  mkdirSync(join(dir, "app/dev-kit/proof"), { recursive: true });
  writeFileSync(join(dir, "app/dev-kit/proof/page.tsx"), "export default function Page() { return null; }\n");
  writeFileSync(join(dir, ".ai-dev-kit/registries/feature-proof.json"), JSON.stringify({
    kind: "feature-proof-registry",
    schema_version: 1,
    policy: {
      requireRegistryForUserFacingChanges: true,
      expectPolicy: "Expect required.",
    },
    ignoredPaths: [".ai-dev-kit/**"],
    proofLanes: {
      fast: {
        label: "Fast",
        command: "pnpm test:fast",
        evidence: [".evidence/tier-1.json"],
      },
      expect: {
        label: "Expect",
        command: "pnpm test:expect",
        evidence: [".evidence/expect-proof.json"],
      },
      release: {
        label: "Release",
        command: "pnpm build:release",
        evidence: [".evidence/release-artifacts.json"],
      },
    },
    features: [{
      id: "dashboard.devkit",
      name: "DevKit",
      userFacing: true,
      surfaces: ["web"],
      paths: ["app/dev-kit/**"],
      proof: ["fast", "expect", "release"],
    }],
  }));
}

function runResolver(dir: string, enforceArtifacts = false) {
  return resolveFeatureProof({
    root: dir,
    files: ["app/dev-kit/proof/page.tsx"],
    enforceArtifacts,
    write: false,
  });
}

describe("feature proof resolver", () => {
  it("records pending, passing, and failing artifact state without requiring enforcement", () => {
    const dir = mkdtempSync(join(tmpdir(), "feature-proof-resolver-"));
    try {
      writeFixtureProject(dir);

      let output = runResolver(dir);
      expect(output.pass).toBe(true);
      expect(output.requiredLanes.find(lane => lane.id === "fast")?.satisfied).toBeNull();

      mkdirSync(join(dir, ".evidence"), { recursive: true });
      writeFileSync(join(dir, ".evidence/tier-1.json"), JSON.stringify({ pass: true }));
      writeFileSync(join(dir, ".evidence/expect-proof.json"), JSON.stringify({ pass: false }));

      output = runResolver(dir);
      expect(output.pass).toBe(true);
      expect(output.requiredLanes.find(lane => lane.id === "fast")?.satisfied).toBe(true);
      expect(output.requiredLanes.find(lane => lane.id === "expect")?.satisfied).toBe(false);

      writeFileSync(join(dir, ".evidence/release-artifacts.json"), JSON.stringify({
        pass: true,
        status: "pending",
        signed: false,
        notarized: false,
        storeUpload: false,
        releaseReady: false,
        artifactCount: 1,
        artifacts: [{ path: "android/app/build/outputs/apk/debug/app-debug.apk" }],
      }));

      output = runResolver(dir);
      const pendingReleaseLane = output.requiredLanes.find(lane => lane.id === "release");
      expect(pendingReleaseLane?.satisfied).toBeNull();
      expect(pendingReleaseLane?.missingEvidence?.join(" ")).toContain("pending signed/notarized/uploaded/reviewable");

      output = runResolver(dir, true);
      expect(output.pass).toBe(false);
      expect(output.blocked.missingArtifactLanes).toContain("release");

      writeFileSync(join(dir, ".evidence/release-artifacts.json"), JSON.stringify({
        pass: true,
        status: "reviewable-internal-artifact",
        signed: false,
        notarized: false,
        storeUpload: false,
        releaseReady: true,
        releaseReviewable: true,
        reviewUrl: "https://work.hustletogether.com/artifacts/release/app-debug.apk",
        artifactCount: 1,
        artifacts: [{ path: "android/app/build/outputs/apk/debug/app-debug.apk" }],
      }));

      output = runResolver(dir, true);
      expect(output.pass).toBe(false);
      expect(output.requiredLanes.find(lane => lane.id === "release")?.satisfied).toBe(true);
      expect(output.blocked.missingArtifactLanes).not.toContain("release");

      writeFileSync(join(dir, ".evidence/release-artifacts.json"), JSON.stringify({
        pass: true,
        status: "release-ready",
        signed: true,
        storeUpload: true,
        releaseReady: true,
        artifactCount: 1,
        artifacts: [{ path: "release/app.dmg" }],
      }));

      output = runResolver(dir);
      expect(output.requiredLanes.find(lane => lane.id === "release")?.satisfied).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails enforcement when a required lane is still pending", () => {
    const dir = mkdtempSync(join(tmpdir(), "feature-proof-resolver-"));
    try {
      writeFixtureProject(dir);

      const output = runResolver(dir, true);
      expect(output.pass).toBe(false);
      expect(output.requiredLanes.find(lane => lane.id === "fast")?.satisfied).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
