#!/usr/bin/env tsx
/**
 * Generate a compact proof packet from the latest local evidence.
 *
 * This does not run tests. It gathers the artifacts produced by the tier
 * runner so a PR, Linear ticket, or Symphony dashboard can link one file.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

function checksumFile(path: string, bytes: number): string | undefined {
  if (bytes > 128 * 1024 * 1024) return undefined;
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function listFiles(dir: string): Array<{ path: string; bytes: number; modifiedAt: string; checksum?: string }> {
  const files: Array<{ path: string; bytes: number; modifiedAt: string; checksum?: string }> = [];
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
        checksum: checksumFile(full, stat.size),
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
  const replay = isRecord(fallback) && isRecord(fallback.replay) ? fallback.replay : undefined;
  const replayFiles = isRecord(replay) && Array.isArray(replay.files) ? replay.files : undefined;
  const replayVideos = isRecord(replay) && Array.isArray(replay.videoFiles) ? replay.videoFiles : undefined;

  return {
    ...statusSummary(path, source),
    tuiTimedOutWithoutSteps: isRecord(tui) ? booleanField(tui, 'timedOutWithoutSteps') : undefined,
    fallbackPass: isRecord(fallback) ? booleanField(fallback, 'pass') : undefined,
    fallbackCommandCount: fallbackCommands?.length,
    fallbackFailedCommandCount: fallbackFailedCommands,
    fallbackReplayPass: isRecord(replay) ? booleanField(replay, 'pass') : undefined,
    fallbackReplayDir: isRecord(replay) ? stringField(replay, 'dir') : undefined,
    fallbackReplayArtifactCount: replayFiles?.length,
    fallbackReplayVideoCount: replayVideos?.length,
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

type ArtifactKind = 'json' | 'image' | 'video' | 'trace' | 'directory' | 'report' | 'artifact';
type ArtifactSource = 'expect' | 'playwright' | 'remotion' | 'native' | 'proof-packet' | 'release';
type ProofArtifact = { path: string; bytes: number; modifiedAt: string; checksum?: string };

function readRunContext(): {
  run_id?: string | null;
  feature_name?: string | null;
  branch?: string | null;
  task?: string | null;
} {
  const envRunId = process.env.RUN_ID?.trim();
  if (envRunId) {
    return {
      run_id: envRunId,
      feature_name: process.env.FEATURE_NAME?.trim() || null,
      branch: process.env.RUN_BRANCH?.trim() || null,
      task: process.env.RUN_TASK?.trim() || null,
    };
  }
  return readJson(join(cwd, '.ai-dev-kit', 'state', 'current-run.json')) ?? {};
}

function splitIds(value: string | null | undefined): string[] {
  return (value ?? '').split(/[,\s]+/).map(item => item.trim()).filter(Boolean);
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value))));
}

function envTaskIds(): string[] {
  return unique([
    ...splitIds(process.env.AI_DEV_KIT_TASK_IDS),
    ...splitIds(process.env.SYMPHONY_TASK_IDS),
    process.env.AI_DEV_KIT_TASK_ID,
    process.env.LINEAR_TASK_ID,
    process.env.LINEAR_ISSUE_ID,
    process.env.LINEAR_IDENTIFIER,
    process.env.SYMPHONY_TASK_ID,
    process.env.SYMPHONY_TICKET_ID,
    process.env.TICKET_ID,
    process.env.ISSUE_ID,
    process.env.TASK_ID,
  ]);
}

function idsFromText(text: string | null | undefined): string[] {
  return Array.from(new Set((text ?? '').match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []));
}

function artifactTaskIds(branch: string | null | undefined, runTask: string | null | undefined): string[] {
  const explicit = envTaskIds();
  if (explicit.length) return explicit;
  const linearIds = unique([...idsFromText(branch), ...idsFromText(runTask)]);
  if (linearIds.length) return linearIds;
  return branch?.startsWith('agent/') ? [branch] : [];
}

function artifactFeatureIds(featureProof: unknown, runFeature: string | null | undefined): string[] {
  const ids: string[] = [];
  if (runFeature) ids.push(runFeature);
  if (isRecord(featureProof) && Array.isArray(featureProof.matchedFeatures)) {
    for (const feature of featureProof.matchedFeatures) {
      if (isRecord(feature) && typeof feature.id === 'string') ids.push(feature.id);
    }
  }
  return unique(ids);
}

function artifactKindFromPath(path: string): ArtifactKind {
  if (/\/$/.test(path)) return 'directory';
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) return 'image';
  if (/\.(mp4|webm|mov)$/i.test(path)) return 'video';
  if (/\.(zip|trace)$/i.test(path) || /trace/i.test(path)) return 'trace';
  if (/\.json$/i.test(path)) return 'json';
  if (/\.(html?|md|txt|log)$/i.test(path)) return 'report';
  return 'artifact';
}

function artifactSourceFromPath(path: string): ArtifactSource {
  const normalized = path.toLowerCase();
  if (normalized.includes('expect')) return 'expect';
  if (normalized.includes('playwright') || normalized.startsWith('test-results/')) return 'playwright';
  if (normalized.includes('remotion') || normalized.includes('frame-check')) return 'remotion';
  if (normalized.startsWith('android/') || normalized.startsWith('ios/') || normalized.includes('native')) return 'native';
  if (normalized.includes('proof-packet')) return 'proof-packet';
  if (normalized.startsWith('dist/') || normalized.startsWith('release/') || normalized.startsWith('out/')) return 'release';
  return 'proof-packet';
}

function laneForArtifact(source: ArtifactSource, path: string): string {
  if (source === 'expect') return 'expect';
  if (source === 'playwright') return /\.(png|jpe?g|webp)$/i.test(path) ? 'visual-proof' : 'playwright';
  if (source === 'remotion') return 'media-proof';
  if (source === 'native') return 'native-device';
  if (source === 'release') return 'release';
  return 'proof-packet';
}

function commandForArtifact(source: ArtifactSource, path: string): string {
  if (source === 'expect') return 'pnpm test:expect';
  if (source === 'playwright') return path.startsWith('test-results/') ? 'pnpm test:e2e' : 'pnpm test:playwright';
  if (source === 'remotion') return 'pnpm --dir examples/remotion-harness-explainer check:frames';
  if (source === 'native') return 'pnpm test:native:smoke';
  if (source === 'release') return 'pnpm build:release';
  return 'pnpm test:proof';
}

function platformForArtifact(source: ArtifactSource, path: string, kind: ArtifactKind): string {
  const text = path.toLowerCase();
  const parts: string[] = [];
  if (/ios|iphone|ipad/.test(text)) parts.push('ios');
  if (/android/.test(text)) parts.push('android');
  if (/macos|darwin/.test(text)) parts.push('macos');
  if (/windows|win32/.test(text)) parts.push('windows');
  if (/mobile/.test(text)) parts.push('mobile');
  if (/desktop/.test(text)) parts.push('desktop');
  if (/light/.test(text)) parts.push('light');
  if (/dark/.test(text)) parts.push('dark');
  if (source === 'expect' || source === 'playwright' || source === 'remotion') parts.push('web');
  if (!parts.length && kind === 'json') parts.push('data');
  if (!parts.length) parts.push(source);
  return unique(parts).join(', ');
}

function passForArtifact(artifactPath: string): boolean | undefined {
  const payload = artifactPath.endsWith('.json') ? readJson<Record<string, unknown>>(join(cwd, artifactPath)) : null;
  if (!isRecord(payload)) return undefined;
  if (typeof payload.pass === 'boolean') return payload.pass;
  if (payload.status === 'pass' || payload.status === 'green') return true;
  if (payload.status === 'fail' || payload.status === 'blocked') return false;
  return undefined;
}

function reviewUrlForArtifact(path: string): string {
  return process.env.ARTIFACT_REVIEW_URL
    ?? process.env.PROOF_REVIEW_URL
    ?? process.env.PULL_REQUEST_URL
    ?? process.env.GITHUB_PULL_REQUEST_URL
    ?? (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : path);
}

function isMetaEvidenceArtifact(path: string): boolean {
  return path === '.evidence/artifact-provenance.json' || path === '.evidence/proof-packet.json';
}

function buildArtifactProvenance(artifacts: ProofArtifact[], options: {
  branch?: string | null;
  commit?: string | null;
  runId?: string | null;
  taskIds?: string[];
  featureIds?: string[];
  includeMetaEvidence?: boolean;
}) {
  const branch = options.branch ?? git(['branch', '--show-current']) ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? '';
  const commit = options.commit ?? git(['rev-parse', '--short', 'HEAD']) ?? process.env.GITHUB_SHA?.slice(0, 12) ?? '';
  const runContext = readRunContext();
  const taskIds = options.taskIds ?? artifactTaskIds(branch, runContext.task);
  const featureIds = options.featureIds ?? artifactFeatureIds(readJson(join(evidenceDir, 'feature-proof-plan.json')), runContext.feature_name);
  const runId = options.runId ?? runContext.run_id ?? null;

  return artifacts
    .filter(artifact => options.includeMetaEvidence || !isMetaEvidenceArtifact(artifact.path))
    .map((artifact) => {
      const source = artifactSourceFromPath(artifact.path);
      const kind = artifactKindFromPath(artifact.path);
      const laneId = laneForArtifact(source, artifact.path);
      const platform = platformForArtifact(source, artifact.path, kind);
      const capturedAt = artifact.modifiedAt;
      const reviewUrl = reviewUrlForArtifact(artifact.path);
      const checksum = artifact.checksum ?? '';
      const fields = { branch, commit, platform, capturedAt, checksum, reviewUrl };
      const missing: string[] = [];
      if (!taskIds.length) missing.push('taskIds');
      for (const [key, value] of Object.entries(fields)) {
        if (!value) missing.push(key);
      }
      const pass = passForArtifact(artifact.path);
      return {
        ...artifact,
        artifactId: createHash('sha256').update(`${artifact.path}:${artifact.modifiedAt}:${artifact.bytes}`).digest('hex').slice(0, 16),
        taskIds,
        featureIds,
        laneId,
        command: commandForArtifact(source, artifact.path),
        source,
        branch: branch ?? '',
        commit: commit ?? '',
        platform,
        capturedAt,
        checksum,
        reviewUrl,
        href: artifact.path,
        kind,
        pass,
        state: missing.length ? 'blocked' : pass === false ? 'blocked' : 'green',
        tags: unique([source, laneId, kind, platform, ...taskIds, ...featureIds]),
        runId,
        missing,
      };
    });
}

function writeArtifactProvenanceManifest(artifacts: ProofArtifact[], context: {
  branch: string | null;
  commit: string | null;
  runId: string | null;
  taskIds: string[];
  featureIds: string[];
}) {
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    taskIds: context.taskIds,
    branch: context.branch ?? '',
    commit: context.commit ?? '',
    runId: context.runId,
    artifacts: buildArtifactProvenance(artifacts, {
      ...context,
      includeMetaEvidence: true,
    }).filter(artifact => artifact.path !== '.evidence/artifact-provenance.json'),
  };
  const out = join(evidenceDir, 'artifact-provenance.json');
  writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
  return { path: out, manifest };
}

function main() {
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = listFiles(evidenceDir);
  const testResults = listFiles(testResultsDir);
  const browserArtifacts = listFiles(join(cwd, 'playwright-report'));
  const remotionArtifacts = [
    ...listFiles(join(cwd, 'remotion-output')),
    ...listFiles(join(cwd, 'examples', 'remotion-harness-explainer', 'out')),
  ];
  const nativeArtifacts = [
    ...listFiles(join(cwd, 'dist')),
    ...listFiles(join(cwd, 'release')),
    ...listFiles(join(cwd, 'out')),
    ...listFiles(join(cwd, 'android/app/build/outputs')),
    ...listFiles(join(cwd, 'ios/App/build')),
  ].slice(0, 500);
  const branch = git(['branch', '--show-current']);
  const head = git(['rev-parse', '--short', 'HEAD']) ?? process.env.GITHUB_SHA?.slice(0, 12) ?? null;
  const runContext = readRunContext();
  const featureProof = readJson(join(evidenceDir, 'feature-proof-plan.json'));
  const taskIds = artifactTaskIds(branch, runContext.task);
  const featureIds = artifactFeatureIds(featureProof, runContext.feature_name);
  const artifactProvenance = buildArtifactProvenance([
    ...evidence,
    ...testResults,
    ...browserArtifacts,
    ...remotionArtifacts,
    ...nativeArtifacts,
  ], {
    branch,
    commit: head,
    runId: runContext.run_id ?? null,
    taskIds,
    featureIds,
  });
  const packet = {
    generatedAt: new Date().toISOString(),
    projectHarness: evaluateProjectHarness(cwd),
    git: {
      branch,
      head,
      status: git(['status', '--short']),
      changedFiles: changedFiles(),
    },
    summary: summarizeProofEvidence(evidenceDir),
    evidence,
    featureProof,
    testResults,
    browserArtifacts,
    nativeArtifacts,
    remotionArtifacts,
    artifactProvenance,
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
  writeArtifactProvenanceManifest([
    ...listFiles(evidenceDir),
    ...testResults,
    ...browserArtifacts,
    ...remotionArtifacts,
    ...nativeArtifacts,
  ], {
    branch,
    commit: head,
    runId: runContext.run_id ?? null,
    taskIds,
    featureIds,
  });
  console.log(`[generate-proof-packet] wrote ${out}`);
}

main();
