#!/usr/bin/env tsx
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const cwd = process.cwd();
const evidenceDir = join(cwd, '.evidence');
const required = process.env.RELEASE_ARTIFACTS_REQUIRED === '1';
const signed = process.env.RELEASE_SIGNED === '1';
const notarized = process.env.RELEASE_NOTARIZED === '1';
const storeUpload = process.env.RELEASE_STORE_UPLOAD === '1';
const releaseReady = process.env.RELEASE_READY === '1' || signed || notarized || storeUpload;
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

mkdirSync(evidenceDir, { recursive: true });
const out = join(evidenceDir, 'release-artifacts.json');
writeFileSync(out, JSON.stringify({
  runAt: new Date().toISOString(),
  pass: artifacts.length > 0 || !required,
  status: releaseReady ? 'release-ready' : artifacts.length > 0 ? 'pending' : required ? 'blocked' : 'pending',
  required,
  signed,
  notarized,
  storeUpload,
  releaseReady,
  releaseStatus: process.env.RELEASE_STATUS ?? (releaseReady ? 'release-ready' : 'artifact-discovery-only'),
  uploadStatus: process.env.RELEASE_UPLOAD_STATUS ?? null,
  artifactCount: artifacts.length,
  artifacts,
}, null, 2) + '\n');
console.log(`[release-artifacts] wrote ${out}`);

if (artifacts.length === 0 && required) {
  console.error('[release-artifacts] no release/native artifacts found.');
  process.exit(1);
}
