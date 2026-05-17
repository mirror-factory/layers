import { describe, expect, it } from "vitest";

import { extractExpectTuiReport, isZeroStepTuiTimeout, shouldRunExpectFallback } from "@/scripts/lib/expect-proof-utils";

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

  it("treats ACP browser streaming failures as fallback-eligible", () => {
    expect(shouldRunExpectFallback(
      null,
      "",
      "BB [@supervisor/ExecutionError]: Streaming failed: Agent produced no output for 180s. reason: KT [AcpStreamError]: couldn't connect to the browser or the target URL is unreachable.",
    )).toBe(true);
  });

  it("does not fallback over a real TUI finding with steps", () => {
    expect(shouldRunExpectFallback(
      {
        status: "failed",
        steps: [{ title: "Button did not respond" }],
        summary: "Found an interaction regression",
      },
      "",
      "Streaming failed after the report",
    )).toBe(false);
  });
});
