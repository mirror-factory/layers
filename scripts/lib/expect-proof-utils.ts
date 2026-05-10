export interface ExpectTuiReport {
  version?: string;
  status?: string;
  title?: string;
  duration_ms?: number;
  steps?: unknown[];
  artifacts?: Record<string, unknown>;
  summary?: string;
}

export function compactText(value: string, limit = 20_000): string {
  if (value.length <= limit) return value;
  return value.slice(-limit);
}

export function extractExpectTuiReport(stdout: string): ExpectTuiReport | null {
  const starts: number[] = [];
  for (let index = stdout.indexOf("{"); index !== -1; index = stdout.indexOf("{", index + 1)) {
    starts.push(index);
  }

  for (const start of starts) {
    const candidate = stdout.slice(start).trim();
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      const report = parsed as ExpectTuiReport;
      if (
        typeof report.status === "string" ||
        typeof report.summary === "string" ||
        Array.isArray(report.steps)
      ) {
        return report;
      }
    } catch {
      // Keep scanning for the trailing JSON report; logs can contain object-like
      // snippets before the final machine-readable payload.
    }
  }

  return null;
}

export function isZeroStepTuiTimeout(report: ExpectTuiReport | null): boolean {
  if (!report) return false;
  const summary = report.summary?.toLowerCase() ?? "";
  return report.status === "failed" && Array.isArray(report.steps) && report.steps.length === 0 && summary.includes("timed out");
}
