import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const resolverPath = join(process.cwd(), "scripts/resolve-feature-proof.ts");
const tsxBin = join(process.cwd(), "node_modules/.bin/tsx");

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
    },
    features: [{
      id: "dashboard.devkit",
      name: "DevKit",
      userFacing: true,
      surfaces: ["web"],
      paths: ["app/dev-kit/**"],
      proof: ["fast", "expect"],
    }],
  }));
}

function runResolver(dir: string, args: string[] = []) {
  return spawnSync(tsxBin, [resolverPath, "--json", "--no-write", ...args], {
    cwd: dir,
    encoding: "utf-8",
    env: { ...process.env, FEATURE_PROOF_FILES: "app/dev-kit/proof/page.tsx" },
  });
}

function parseOutput(result: ReturnType<typeof runResolver>) {
  expect(result.stdout).not.toEqual("");
  return JSON.parse(result.stdout) as {
    requiredLanes: Array<{ id: string; satisfied: boolean | null; missingEvidence: string[] }>;
  };
}

describe("feature proof resolver", () => {
  it("records pending, passing, and failing artifact state without requiring enforcement", () => {
    const dir = mkdtempSync(join(tmpdir(), "feature-proof-resolver-"));
    try {
      writeFixtureProject(dir);

      let result = runResolver(dir);
      expect(result.status).toBe(0);
      let output = parseOutput(result);
      expect(output.requiredLanes.find(lane => lane.id === "fast")?.satisfied).toBeNull();

      mkdirSync(join(dir, ".evidence"), { recursive: true });
      writeFileSync(join(dir, ".evidence/tier-1.json"), JSON.stringify({ pass: true }));
      writeFileSync(join(dir, ".evidence/expect-proof.json"), JSON.stringify({ pass: false }));

      result = runResolver(dir);
      expect(result.status).toBe(0);
      output = parseOutput(result);
      expect(output.requiredLanes.find(lane => lane.id === "fast")?.satisfied).toBe(true);
      expect(output.requiredLanes.find(lane => lane.id === "expect")?.satisfied).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails enforcement when a required lane is still pending", () => {
    const dir = mkdtempSync(join(tmpdir(), "feature-proof-resolver-"));
    try {
      writeFixtureProject(dir);

      const result = runResolver(dir, ["--enforce-artifacts"]);
      expect(result.status).toBe(1);
      const output = parseOutput(result);
      expect(output.requiredLanes.find(lane => lane.id === "fast")?.satisfied).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
