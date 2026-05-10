import { describe, expect, it } from "vitest";

import { extractExpectTuiReport, isZeroStepTuiTimeout } from "@/scripts/lib/expect-proof-utils";

describe("expect proof utils", () => {
  it("extracts the trailing Expect TUI JSON report from log output", () => {
    const report = extractExpectTuiReport(`log line
{ not: "json" }
{
  "version": "0.1.3",
  "status": "failed",
  "duration_ms": 180000,
  "steps": [],
  "artifacts": {},
  "summary": "Timed out after 3m"
}
`);

    expect(report).toMatchObject({
      version: "0.1.3",
      status: "failed",
      summary: "Timed out after 3m",
    });
  });

  it("detects zero-step TUI timeouts as fallback-eligible", () => {
    expect(isZeroStepTuiTimeout({
      status: "failed",
      steps: [],
      summary: "Timed out after 3m",
    })).toBe(true);

    expect(isZeroStepTuiTimeout({
      status: "failed",
      steps: [{ title: "found a bug" }],
      summary: "Timed out after 3m",
    })).toBe(false);
  });
});
