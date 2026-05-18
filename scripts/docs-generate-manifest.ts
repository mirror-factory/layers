#!/usr/bin/env tsx
/**
 * Generate docs/manifest.json for compliance and dashboard freshness checks.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

interface DocEntry {
  id: string;
  localPath: string;
  contentHash: string;
  priority: 'hot' | 'warm' | 'cold';
}

const cwd = process.cwd();
const docsDir = join(cwd, 'docs');
const outPath = join(docsDir, 'manifest.json');

const hotDocs = new Set([
  'docs/GETTING_STARTED.md',
  'docs/RELEASE.md',
  'docs/FEATURE_TEST_PLAN.md',
  'docs/FEATURE_TEST_MARKETING_MATRIX.md',
  'docs/INCIDENT_RUNBOOK.md',
  'docs/LAUNCH_CHECKLIST.md',
  'docs/RECORDING_RELIABILITY.md',
  'docs/PRICING_AND_BILLING.md',
  'docs/guides/AI-STARTER-HUB.md',
]);

function slug(path: string): string {
  return path
    .replace(/^docs\//, '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function priority(path: string): DocEntry['priority'] {
  if (hotDocs.has(path)) return 'hot';
  if (path.startsWith('docs/apis/') || path.startsWith('docs/features/') || path.startsWith('docs/components/')) {
    return 'warm';
  }
  return 'cold';
}

function walk(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (full === outPath) continue;
    if (!/\.(md|mdx|json)$/i.test(entry.name)) continue;
    files.push(full);
  }

  return files;
}

function main() {
  mkdirSync(docsDir, { recursive: true });
  const docs: DocEntry[] = walk(docsDir)
    .filter(file => statSync(file).isFile())
    .map(file => {
      const localPath = relative(cwd, file);
      const content = readFileSync(file, 'utf-8');
      return {
        id: slug(localPath),
        localPath,
        contentHash: hash(content),
        priority: priority(localPath),
      };
    })
    .sort((a, b) => a.localPath.localeCompare(b.localPath));

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    docs,
  };

  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`[docs-generate-manifest] wrote ${relative(cwd, outPath)} with ${docs.length} entries`);
}

main();
