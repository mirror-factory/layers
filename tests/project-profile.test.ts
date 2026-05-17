import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLatestProofPacket } from "../lib/ai-dev-kit/proof-packet";
import { evaluateProjectHarness, loadProjectProfile, writeProjectHarnessReport } from "../lib/ai-dev-kit/project-profile";

describe("project profile harness", () => {
  it("loads the Layers project profile", () => {
    const profile = loadProjectProfile(process.cwd());

    expect(profile.project.id).toBe("layers");
    expect(profile.branchModel.integration).toBe("development");
    expect(profile.designSystem.mode).toBe("no-inference");
    expect(profile.tools.expect.required).toBe(true);
  });

  it("evaluates the current project without blocking failures", () => {
    const report = evaluateProjectHarness(process.cwd());

    expect(report.pass).toBe(true);
    expect(report.enabledPlatforms).toContain("web");
    expect(report.enabledServices).toContain("supabase");
    expect(report.requiredTools).toContain("playwright");
    expect(report.checks.some(check => check.id === "tool.expect" && check.status === "pass")).toBe(true);
  });

  it("reports a missing profile as a blocking failure", () => {
    const dir = mkdtempSync(join(tmpdir(), "project-profile-"));
    try {
      const report = evaluateProjectHarness(dir);
      expect(report.pass).toBe(false);
      expect(report.checks[0]?.id).toBe("project-profile.present");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes evidence for dashboard and proof packets", () => {
    const out = writeProjectHarnessReport(process.cwd());

    expect(out.endsWith(".evidence/project-harness.json")).toBe(true);
  });

  it("loads the latest proof packet when present", () => {
    const dir = mkdtempSync(join(tmpdir(), "proof-packet-"));
    try {
      mkdirSync(join(dir, ".evidence"));
      writeFileSync(join(dir, ".evidence/proof-packet.json"), JSON.stringify({
        generatedAt: "2026-05-09T00:00:00.000Z",
        git: { branch: "agent/test", changedFiles: ["app/page.tsx"] },
        evidence: [],
      }));

      const latest = loadLatestProofPacket(dir);
      expect(latest.present).toBe(true);
      expect(latest.packet?.git?.branch).toBe("agent/test");
      expect(latest.packet?.git?.changedFiles).toEqual(["app/page.tsx"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
