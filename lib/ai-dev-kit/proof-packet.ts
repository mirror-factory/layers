import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { evaluateProjectHarness, type ProjectHarnessReport } from './project-profile';

export type ArtifactKind = 'json' | 'image' | 'video' | 'trace' | 'directory' | 'report' | 'artifact';

export type ArtifactSource = 'expect' | 'playwright' | 'remotion' | 'native' | 'proof-packet' | 'release';

export interface ProofArtifact {
  path: string;
  bytes: number;
  modifiedAt: string;
  checksum?: string;
}

export interface ArtifactProvenance extends ProofArtifact {
  artifactId: string;
  taskIds: string[];
  featureIds: string[];
  laneId: string;
  command: string;
  source: ArtifactSource;
  branch: string;
  commit: string;
  platform: string;
  capturedAt: string;
  reviewUrl: string;
  href: string;
  kind: ArtifactKind;
  pass?: boolean;
  state: 'green' | 'blocked' | 'pending';
  tags: string[];
  runId?: string | null;
  missing: string[];
}

export interface ArtifactProvenanceManifest {
  schemaVersion: 1;
  generatedAt: string;
  taskIds: string[];
  branch: string;
  commit: string;
  runId: string | null;
  artifacts: ArtifactProvenance[];
}

export interface ProofStatusSummary {
  path: string;
  pass?: boolean;
  status?: string;
  skipped?: boolean;
  required?: boolean;
  runAt?: string;
  durationMs?: number;
  exitCode?: number;
  booleanFields?: Record<string, boolean>;
}

export interface ProofTierSummary extends ProofStatusSummary {
  tier?: number;
  gateCount?: number;
  passedGates?: number;
  failedGates?: number;
  skippedGates?: number;
  totalDurationMs?: number;
}

export interface ProofNativeConfigSummary extends ProofStatusSummary {
  enabledNativePlatforms?: string[];
  artifactCount?: number;
  checkCount?: number;
  failedChecks?: number;
  warningChecks?: number;
}

export interface ProofRunnerCapabilitySummary extends ProofStatusSummary {
  platform?: string;
  arch?: string;
  githubActions?: boolean;
  readiness?: Record<string, boolean>;
  checks?: Record<string, boolean>;
}

export interface ProofNativeSmokeSummary extends ProofStatusSummary {
  platform?: string;
  device?: string;
  runner?: string;
  flowCommand?: string;
  runUrl?: string;
  screenshotCount?: number;
  videoCount?: number;
  logCount?: number;
  artifactCount?: number;
  missing?: string[];
}

export interface ProofSummary {
  expectProof?: ProofStatusSummary;
  tiers?: ProofTierSummary[];
  nativeConfig?: ProofNativeConfigSummary;
  runnerCapability?: ProofRunnerCapabilitySummary;
  nativeSmoke?: ProofNativeSmokeSummary;
}

export interface ProofPacket {
  generatedAt: string;
  projectHarness?: ProjectHarnessReport;
  git?: {
    branch?: string | null;
    head?: string | null;
    status?: string | null;
    changedFiles?: string[];
  };
  summary?: ProofSummary;
  evidence?: ProofArtifact[];
  featureProof?: Record<string, unknown> | null;
  testResults?: ProofArtifact[];
  browserArtifacts?: ProofArtifact[];
  nativeArtifacts?: ProofArtifact[];
  remotionArtifacts?: ProofArtifact[];
  artifactProvenance?: ArtifactProvenance[];
  starter?: {
    scorecard?: string | null;
    browserProof?: string | null;
  };
}

export interface LatestProofPacket {
  present: boolean;
  path: string;
  updatedAt: string | null;
  packet: ProofPacket | null;
  error?: string;
}

export function proofPacketPath(cwd = process.cwd()): string {
  return join(cwd, '.evidence', 'proof-packet.json');
}

export function artifactProvenancePath(cwd = process.cwd()): string {
  return join(cwd, '.evidence', 'artifact-provenance.json');
}

export function loadLatestProofPacket(cwd = process.cwd()): LatestProofPacket {
  const path = proofPacketPath(cwd);
  if (!existsSync(path)) {
    return {
      present: false,
      path,
      updatedAt: null,
      packet: null,
    };
  }

  try {
    const stat = statSync(path);
    return {
      present: true,
      path,
      updatedAt: stat.mtime.toISOString(),
      packet: JSON.parse(readFileSync(path, 'utf-8')) as ProofPacket,
    };
  } catch (error) {
    return {
      present: true,
      path,
      updatedAt: null,
      packet: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function git(cwd: string, args: string[]): string | null {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function gitLines(cwd: string, args: string[]): string[] {
  return git(cwd, args)?.split('\n').map(line => line.trim()).filter(Boolean) ?? [];
}

function changedFiles(cwd: string): string[] {
  return Array.from(new Set([
    ...gitLines(cwd, ['diff', '--name-only']),
    ...gitLines(cwd, ['diff', '--cached', '--name-only']),
    ...gitLines(cwd, ['ls-files', '--others', '--exclude-standard']),
  ])).sort((a, b) => a.localeCompare(b));
}

function checksumFile(path: string, bytes: number): string | undefined {
  if (bytes > 128 * 1024 * 1024) return undefined;
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function listFiles(cwd: string, dir: string): ProofArtifact[] {
  const files: ProofArtifact[] = [];
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

function readRunContext(cwd: string): {
  run_id?: string | null;
  feature_name?: string | null;
  branch?: string | null;
  task?: string | null;
} {
  const path = join(cwd, '.ai-dev-kit', 'state', 'current-run.json');
  const envRunId = process.env.RUN_ID?.trim();
  if (envRunId) {
    return {
      run_id: envRunId,
      feature_name: process.env.FEATURE_NAME?.trim() || null,
      branch: process.env.RUN_BRANCH?.trim() || null,
      task: process.env.RUN_TASK?.trim() || null,
    };
  }
  return readJson(path) ?? {};
}

function splitIds(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/[,\s]+/)
    .map(item => item.trim())
    .filter(Boolean);
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
  if (normalized.includes('release-artifacts')) return 'release';
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
  return 'npx ai-dev-kit proof generate';
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

function passForArtifact(cwd: string, artifactPath: string): boolean | undefined {
  const payload = artifactPath.endsWith('.json') ? readJson<Record<string, unknown>>(join(cwd, artifactPath)) : null;
  if (!isRecord(payload)) return undefined;
  if (typeof payload.pass === 'boolean') return payload.pass;
  if (payload.status === 'pass' || payload.status === 'green') return true;
  if (payload.status === 'fail' || payload.status === 'blocked') return false;
  return undefined;
}

function releaseArtifactReady(payload: Record<string, unknown>): boolean {
  const statusText = [
    stringField(payload, 'status'),
    stringField(payload, 'releaseStatus'),
    stringField(payload, 'uploadStatus'),
  ].filter(Boolean).join(' ').toLowerCase();
  return payload.signed === true
    || payload.notarized === true
    || payload.releaseReady === true
    || payload.releaseReviewable === true
    || payload.storeUpload === true
    || /\b(signed|notarized|uploaded|reviewable|release-ready|green)\b/.test(statusText);
}

function stateForArtifact(cwd: string, artifactPath: string): 'green' | 'blocked' | 'pending' | undefined {
  const payload = artifactPath.endsWith('.json') ? readJson<Record<string, unknown>>(join(cwd, artifactPath)) : null;
  if (!isRecord(payload)) return undefined;
  if (artifactPath.endsWith('release-artifacts.json')) {
    if (payload.status === 'blocked' || payload.status === 'fail' || (payload.pass === false && payload.required === true)) return 'blocked';
    if (payload.status === 'pending' || payload.skipped === true) return 'pending';
    if (payload.pass === true || payload.status === 'ready' || payload.status === 'pass' || payload.status === 'green') {
      return releaseArtifactReady(payload) ? 'green' : 'pending';
    }
    return undefined;
  }
  if (payload.status === 'pending' || payload.skipped === true) return 'pending';
  if (payload.status === 'blocked' || payload.status === 'fail' || payload.pass === false) return 'blocked';
  if (payload.status === 'ready' || payload.status === 'pass' || payload.status === 'green' || payload.pass === true) return 'green';
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

export function buildArtifactProvenance(
  cwd: string,
  artifacts: ProofArtifact[],
  options: {
    branch?: string | null;
    commit?: string | null;
    runId?: string | null;
    taskIds?: string[];
    featureIds?: string[];
    includeMetaEvidence?: boolean;
  } = {},
): ArtifactProvenance[] {
  const branch = options.branch ?? git(cwd, ['branch', '--show-current']) ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? '';
  const commit = options.commit ?? git(cwd, ['rev-parse', '--short', 'HEAD']) ?? process.env.GITHUB_SHA?.slice(0, 12) ?? '';
  const runContext = readRunContext(cwd);
  const taskIds = options.taskIds ?? artifactTaskIds(branch, runContext.task);
  const featureIds = options.featureIds ?? artifactFeatureIds(readJson(join(cwd, '.evidence', 'feature-proof-plan.json')), runContext.feature_name);
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
      const pass = passForArtifact(cwd, artifact.path);
      const explicitState = stateForArtifact(cwd, artifact.path);
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
        state: missing.length ? 'blocked' : explicitState ?? (pass === false ? 'blocked' : 'green'),
        tags: unique([source, laneId, kind, platform, ...taskIds, ...featureIds]),
        runId,
        missing,
      };
    });
}

function collectProofArtifacts(cwd: string): ProofArtifact[] {
  return [
    ...listFiles(cwd, join(cwd, '.evidence')),
    ...listFiles(cwd, join(cwd, 'test-results')),
    ...listFiles(cwd, join(cwd, 'playwright-report')),
    ...listFiles(cwd, join(cwd, 'remotion-output')),
    ...listFiles(cwd, join(cwd, 'examples', 'remotion-harness-explainer', 'out')),
    ...listFiles(cwd, join(cwd, 'dist')),
    ...listFiles(cwd, join(cwd, 'release')),
    ...listFiles(cwd, join(cwd, 'out')),
    ...listFiles(cwd, join(cwd, 'android/app/build/outputs')),
    ...listFiles(cwd, join(cwd, 'ios/App/build')),
  ];
}

export function writeArtifactProvenanceManifest(
  cwd = process.cwd(),
  artifacts: ProofArtifact[] = collectProofArtifacts(cwd),
): { path: string; manifest: ArtifactProvenanceManifest } {
  const evidenceDir = join(cwd, '.evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const runContext = readRunContext(cwd);
  const branch = git(cwd, ['branch', '--show-current']) ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? runContext.branch ?? '';
  const commit = git(cwd, ['rev-parse', '--short', 'HEAD']) ?? process.env.GITHUB_SHA?.slice(0, 12) ?? '';
  const taskIds = artifactTaskIds(branch, runContext.task);
  const featureIds = artifactFeatureIds(readJson(join(cwd, '.evidence', 'feature-proof-plan.json')), runContext.feature_name);
  const manifest: ArtifactProvenanceManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    taskIds,
    branch: branch ?? '',
    commit,
    runId: runContext.run_id ?? null,
    artifacts: buildArtifactProvenance(cwd, artifacts, {
      branch,
      commit,
      runId: runContext.run_id ?? null,
      taskIds,
      featureIds,
      includeMetaEvidence: true,
    }).filter(artifact => artifact.path !== '.evidence/artifact-provenance.json'),
  };
  const out = artifactProvenancePath(cwd);
  writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
  return { path: out, manifest };
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

function statusSummary(path: string, source: Record<string, unknown>): ProofStatusSummary {
  const summary: ProofStatusSummary = {
    path,
    pass: booleanField(source, 'pass'),
    status: stringField(source, 'status'),
    skipped: booleanField(source, 'skipped'),
    required: booleanField(source, 'required'),
    runAt: stringField(source, 'runAt'),
    durationMs: numberField(source, 'durationMs'),
    exitCode: numberField(source, 'exitCode'),
    booleanFields: booleanFields(source),
  };

  return Object.fromEntries(
    Object.entries(summary).filter(([, value]) => value !== undefined),
  ) as ProofStatusSummary;
}

function countByStatus(items: unknown, status: string): number | undefined {
  if (!Array.isArray(items)) return undefined;
  return items.filter(item => isRecord(item) && item.status === status).length;
}

function summarizeTier(path: string, source: Record<string, unknown>): ProofTierSummary {
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

function summarizeNativeConfig(path: string, source: Record<string, unknown>): ProofNativeConfigSummary {
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

function summarizeRunnerCapability(path: string, source: Record<string, unknown>): ProofRunnerCapabilitySummary {
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

function summarizeNativeSmoke(path: string, source: Record<string, unknown>): ProofNativeSmokeSummary {
  return {
    ...statusSummary(path, source),
    platform: stringField(source, 'platform'),
    device: stringField(source, 'device'),
    runner: stringField(source, 'runner'),
    flowCommand: stringField(source, 'flowCommand'),
    runUrl: stringField(source, 'runUrl'),
    screenshotCount: Array.isArray(source.screenshots) ? source.screenshots.length : undefined,
    videoCount: Array.isArray(source.videos) ? source.videos.length : undefined,
    logCount: Array.isArray(source.logs) ? source.logs.length : undefined,
    artifactCount: Array.isArray(source.artifacts) ? source.artifacts.length : undefined,
    missing: stringArrayField(source, 'missing'),
  };
}

function summarizeProofEvidence(cwd: string, evidenceDir: string): ProofSummary | undefined {
  const summary: ProofSummary = {};

  const expectProof = readJson<Record<string, unknown>>(join(evidenceDir, 'expect-proof.json'));
  if (isRecord(expectProof)) {
    summary.expectProof = statusSummary('.evidence/expect-proof.json', expectProof);
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
      .filter((item): item is ProofTierSummary => item !== null);
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

  const nativeSmoke = readJson<Record<string, unknown>>(join(evidenceDir, 'native-smoke.json'));
  if (isRecord(nativeSmoke)) {
    summary.nativeSmoke = summarizeNativeSmoke('.evidence/native-smoke.json', nativeSmoke);
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

export function generateProofPacket(cwd = process.cwd()): { path: string; packet: ProofPacket } {
  const evidenceDir = join(cwd, '.evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = listFiles(cwd, evidenceDir);
  const testResults = listFiles(cwd, join(cwd, 'test-results'));
  const browserArtifacts = listFiles(cwd, join(cwd, 'playwright-report'));
  const remotionArtifacts = [
    ...listFiles(cwd, join(cwd, 'remotion-output')),
    ...listFiles(cwd, join(cwd, 'examples', 'remotion-harness-explainer', 'out')),
  ];
  const nativeArtifacts = [
    ...listFiles(cwd, join(cwd, 'dist')),
    ...listFiles(cwd, join(cwd, 'release')),
    ...listFiles(cwd, join(cwd, 'out')),
    ...listFiles(cwd, join(cwd, 'android/app/build/outputs')),
    ...listFiles(cwd, join(cwd, 'ios/App/build')),
  ].slice(0, 500);
  const branch = git(cwd, ['branch', '--show-current']);
  const head = git(cwd, ['rev-parse', '--short', 'HEAD']) ?? process.env.GITHUB_SHA?.slice(0, 12) ?? null;
  const runContext = readRunContext(cwd);
  const featureProof = readJson<ProofPacket['featureProof']>(join(evidenceDir, 'feature-proof-plan.json'));
  const taskIds = artifactTaskIds(branch, runContext.task);
  const featureIds = artifactFeatureIds(featureProof, runContext.feature_name);
  const artifactProvenance = buildArtifactProvenance(cwd, [
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

  const packet: ProofPacket = {
    generatedAt: new Date().toISOString(),
    projectHarness: evaluateProjectHarness(cwd),
    git: {
      branch,
      head,
      status: git(cwd, ['status', '--short']),
      changedFiles: changedFiles(cwd),
    },
    summary: summarizeProofEvidence(cwd, evidenceDir),
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

  const out = proofPacketPath(cwd);
  writeFileSync(out, JSON.stringify(packet, null, 2) + '\n');
  writeArtifactProvenanceManifest(cwd);
  return { path: out, packet };
}
