#!/usr/bin/env tsx

import { writeProjectHarnessReport, evaluateProjectHarness } from "../lib/ai-dev-kit/project-profile";

const report = evaluateProjectHarness(process.cwd());
const out = writeProjectHarnessReport(process.cwd());

for (const check of report.checks) {
  const tag = check.status === "pass" ? "pass" : check.status === "warn" ? "warn" : "fail";
  console.log(`[project-profile] ${tag}: ${check.label} -- ${check.detail}`);
}

console.log(`[project-profile] wrote ${out}`);

if (!report.pass) {
  const failures = report.checks.filter(check => check.status === "fail");
  console.error(`[project-profile] ${failures.length} blocking project harness check(s) failed.`);
  process.exit(1);
}
