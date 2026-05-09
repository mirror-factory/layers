#!/usr/bin/env tsx
/**
 * Generate a compact proof packet from the latest local evidence.
 *
 * This does not run tests. It gathers the artifacts produced by the tier
 * runner so a PR, Linear ticket, or Symphony dashboard can link one file.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const cwd = process.cwd();
const evidenceDir = join(cwd, '.evidence');
const testResultsDir = join(cwd, 'test-results');

function git(args: string[]): string | null {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  return result.status === 0 ? result.stdout.trim() : null;
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

function main() {
  mkdirSync(evidenceDir, { recursive: true });
  const packet = {
    generatedAt: new Date().toISOString(),
    git: {
      branch: git(['branch', '--show-current']),
      head: git(['rev-parse', '--short', 'HEAD']),
      status: git(['status', '--short']),
    },
    evidence: listFiles(evidenceDir),
    testResults: listFiles(testResultsDir),
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
