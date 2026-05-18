#!/usr/bin/env tsx
/**
 * Generate a compact proof packet from the latest local evidence.
 *
 * This does not run tests. It gathers the artifacts produced by the tier
 * runner so a PR, Linear ticket, or Symphony dashboard can link one file.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { evaluateProjectHarness } from '../lib/ai-dev-kit/project-profile';

const cwd = process.cwd();
const evidenceDir = join(cwd, '.evidence');
const testResultsDir = join(cwd, 'test-results');

function git(args: string[]): string | null {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function gitLines(args: string[]): string[] {
  return git(args)?.split('\n').map(line => line.trim()).filter(Boolean) ?? [];
}

function changedFiles(): string[] {
  return Array.from(new Set([
    ...gitLines(['diff', '--name-only']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ])).sort((a, b) => a.localeCompare(b));
}

function listFiles(dir: string): Array<{ path: string; bytes: number; modifiedAt: string }> {
  const files: Array<{ path: string; bytes: number; modifiedAt: string }> = [];
  if (!existsSync(dir)) return files;

  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = statSync(full);
      files.push({
        path: relative(cwd, full),
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }

  walk(dir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function numberField(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' ? value : undefined;
}

function booleanField(source: Record<string, unknown>, key: string): boolean | undefined {
  const value = source[key];
  return typeof value === 'boolean' ? value : undefined;
}

function booleanFields(source: Record<string, unknown>): Record<string, boolean> | undefined {
  const fields = Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
  return Object.keys(fields).length > 0 ? fields : undefined;
}

function booleanMap(value: unknown): Record<string, boolean> | undefined {
  if (!isRecord(value)) return undefined;
  return booleanFields(value);
}

function stringArrayField(source: Record<string, unknown>, key: string): string[] | undefined {
  const value = source[key];
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : undefined;
}

function statusSummary(path: string, source: Record<string, unknown>) {
  const summary = {
    path,
    pass: booleanField(source, 'pass'),
    status: stringField(source, 'status'),
    mode: stringField(source, 'mode'),
    skipped: booleanField(source, 'skipped'),
    required: booleanField(source, 'required'),
    runAt: stringField(source, 'runAt'),
    durationMs: numberField(source, 'durationMs'),
    exitCode: numberField(source, 'exitCode'),
    booleanFields: booleanFields(source),
  };

  return Object.fromEntries(
    Object.entries(summary).filter(([, value]) => value !== undefined),
  );
}

function summarizeExpectProof(path: string, source: Record<string, unknown>) {
  const tui = source.tui;
  const fallback = source.fallback;
  const fallbackCommands = isRecord(fallback) && Array.isArray(fallback.commands) ? fallback.commands : undefined;
  const fallbackFailedCommands = fallbackCommands?.filter(command => isRecord(command) && command.pass === false).length;

  return {
    ...statusSummary(path, source),
    tuiTimedOutWithoutSteps: isRecord(tui) ? booleanField(tui, 'timedOutWithoutSteps') : undefined,
    fallbackPass: isRecord(fallback) ? booleanField(fallback, 'pass') : undefined,
    fallbackCommandCount: fallbackCommands?.length,
    fallbackFailedCommandCount: fallbackFailedCommands,
  };
}

function countByStatus(items: unknown, status: string): number | undefined {
  if (!Array.isArray(items)) return undefined;
  return items.filter(item => isRecord(item) && item.status === status).length;
}

function summarizeTier(path: string, source: Record<string, unknown>) {
  const gates = source.gates;
  return {
    ...statusSummary(path, source),
    pass: booleanField(source, 'pass') ?? (source.status === 'pass' ? true : source.status === 'fail' ? false : undefined),
    tier: numberField(source, 'tier'),
    gateCount: Array.isArray(gates) ? gates.length : undefined,
    passedGates: countByStatus(gates, 'pass'),
    failedGates: countByStatus(gates, 'fail'),
    skippedGates: countByStatus(gates, 'skipped'),
    totalDurationMs: numberField(source, 'totalDurationMs'),
  };
}

function summarizeNativeConfig(path: string, source: Record<string, unknown>) {
  const checks = source.checks;
  return {
    ...statusSummary(path, source),
    enabledNativePlatforms: stringArrayField(source, 'enabledNativePlatforms'),
    artifactCount: numberField(source, 'artifactCount'),
    checkCount: Array.isArray(checks) ? checks.length : undefined,
    failedChecks: countByStatus(checks, 'fail'),
    warningChecks: countByStatus(checks, 'warn'),
  };
}

function summarizeRunnerCapability(path: string, source: Record<string, unknown>) {
  const githubActions = source.githubActions;
  return {
    ...statusSummary(path, source),
    platform: stringField(source, 'platform'),
    arch: stringField(source, 'arch'),
    githubActions: isRecord(githubActions) ? booleanField(githubActions, 'isActions') : undefined,
    readiness: booleanMap(source.readiness),
    checks: booleanMap(source.checks),
  };
}

function summarizeProofEvidence(evidenceDir: string) {
  const summary: Record<string, unknown> = {};

  const expectProof = readJson<Record<string, unknown>>(join(evidenceDir, 'expect-proof.json'));
  if (isRecord(expectProof)) {
    summary.expectProof = summarizeExpectProof('.evidence/expect-proof.json', expectProof);
  }

  if (existsSync(evidenceDir)) {
    const tiers = readdirSync(evidenceDir)
      .filter(name => /^tier-.*\.json$/.test(name))
      .sort((a, b) => a.localeCompare(b))
      .map(name => {
        const path = join(evidenceDir, name);
        const payload = readJson<Record<string, unknown>>(path);
        return isRecord(payload) ? summarizeTier(relative(cwd, path), payload) : null;
      })
      .filter(item => item !== null);
    if (tiers.length > 0) summary.tiers = tiers;
  }

  const nativeConfig = readJson<Record<string, unknown>>(join(evidenceDir, 'native-config.json'));
  if (isRecord(nativeConfig)) {
    summary.nativeConfig = summarizeNativeConfig('.evidence/native-config.json', nativeConfig);
  }

  const runnerCapability = readJson<Record<string, unknown>>(join(evidenceDir, 'runner-capability.json'));
  if (isRecord(runnerCapability)) {
    summary.runnerCapability = summarizeRunnerCapability('.evidence/runner-capability.json', runnerCapability);
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

function main() {
  mkdirSync(evidenceDir, { recursive: true });
  const packet = {
    generatedAt: new Date().toISOString(),
    projectHarness: evaluateProjectHarness(cwd),
    git: {
      branch: git(['branch', '--show-current']),
      head: git(['rev-parse', '--short', 'HEAD']),
      status: git(['status', '--short']),
      changedFiles: changedFiles(),
    },
    summary: summarizeProofEvidence(evidenceDir),
    evidence: listFiles(evidenceDir),
    featureProof: readJson(join(evidenceDir, 'feature-proof-plan.json')),
    testResults: listFiles(testResultsDir),
    browserArtifacts: listFiles(join(cwd, 'playwright-report')),
    nativeArtifacts: [
      ...listFiles(join(cwd, 'dist')),
      ...listFiles(join(cwd, 'android/app/build/outputs')),
      ...listFiles(join(cwd, 'ios/App/build')),
    ].slice(0, 500),
    starter: {
      scorecard: existsSync(join(cwd, '.ai-starter/runs/latest-scorecard.json'))
        ? '.ai-starter/runs/latest-scorecard.json'
        : null,
      browserProof: existsSync(join(cwd, '.ai-starter/manifests/browser-proof.json'))
        ? '.ai-starter/manifests/browser-proof.json'
        : null,
    },
  };

  const out = join(evidenceDir, 'proof-packet.json');
  writeFileSync(out, JSON.stringify(packet, null, 2) + '\n');
  console.log(`[generate-proof-packet] wrote ${out}`);
}

main();
