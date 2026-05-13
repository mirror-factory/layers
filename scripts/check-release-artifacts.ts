#!/usr/bin/env tsx
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const cwd = process.cwd();
const evidenceDir = join(cwd, '.evidence');
const required = process.env.RELEASE_ARTIFACTS_REQUIRED === '1';
const signed = process.env.RELEASE_SIGNED === '1';
const notarized = process.env.RELEASE_NOTARIZED === '1';
const storeUpload = process.env.RELEASE_STORE_UPLOAD === '1';
const releaseReviewable = process.env.RELEASE_REVIEWABLE === '1';
const releaseReady = process.env.RELEASE_READY === '1' || signed || notarized || storeUpload;
const releaseProofSatisfied = releaseReady || releaseReviewable;
const roots = [
  'dist',
  'release',
  'android/app/build/outputs',
  'ios/App/build',
  'out',
];

function listFiles(root: string): Array<{ path: string; bytes: number; modifiedAt: string }> {
  const fullRoot = join(cwd, root);
  const files: Array<{ path: string; bytes: number; modifiedAt: string }> = [];
  if (!existsSync(fullRoot)) return files;

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

  walk(fullRoot);
  return files;
}

const artifacts = roots.flatMap(listFiles)
  .filter(file => !file.path.includes('.map'))
  .sort((a, b) => a.path.localeCompare(b.path))
  .slice(0, 500);

const status = artifacts.length === 0
  ? required ? 'blocked' : 'pending'
  : releaseReady
    ? 'release-ready'
    : releaseReviewable
      ? 'reviewable-internal-artifact'
      : 'artifact-discovery-only';

mkdirSync(evidenceDir, { recursive: true });
const out = join(evidenceDir, 'release-artifacts.json');
writeFileSync(out, JSON.stringify({
  runAt: new Date().toISOString(),
  pass: required ? artifacts.length > 0 && releaseProofSatisfied : artifacts.length > 0 || !required,
  status,
  required,
  signed,
  notarized,
  storeUpload,
  releaseReviewable,
  releaseReady,
  productionReleaseReady: releaseReady,
  releaseProofSatisfied,
  releaseStatus: process.env.RELEASE_STATUS ?? status,
  uploadStatus: process.env.RELEASE_UPLOAD_STATUS ?? null,
  reviewUrl: process.env.RELEASE_REVIEW_URL ?? null,
  artifactCount: artifacts.length,
  artifacts,
  proofBoundary: "Reviewable internal artifacts are build-review evidence only. They do not prove signing, notarization, store upload, install/open behavior, or production release approval unless those fields are explicitly true.",
}, null, 2) + '\n');
console.log(`[release-artifacts] wrote ${out}`);

if (required && (artifacts.length === 0 || !releaseProofSatisfied)) {
  console.error(artifacts.length === 0
    ? '[release-artifacts] no release/native artifacts found.'
    : '[release-artifacts] artifacts found, but no signed, notarized, uploaded, release-ready, or explicitly reviewable proof was recorded.');
  process.exit(1);
}
