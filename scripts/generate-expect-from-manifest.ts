#!/usr/bin/env tsx
// @ts-nocheck
/**
 * generate-expect-from-manifest -- read features/<feature>/TEST-MANIFEST.yaml
 * and emit tests/expect/<feature>.expect.ts.
 *
 * Invocation:
 *   npx tsx scripts/generate-expect-from-manifest.ts <feature>
 *
 * The Expect generator turns structured steps into route-owned natural-language
 * plans for expect-cli. Where the action has a description,
 * that description is used verbatim as the toMatch() sentence. Where it
 * does not, the generator falls back to a synthesized sentence from the
 * action + locator.
 *
 * Generated output is owned by this script. Manual edits are clobbered.
 * Use escape_hatch (language: expect) to inject verbatim test code.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseManifest, type Manifest, type Step } from './lib/manifest-parser.ts';

const CWD = process.cwd();

function usage(): never {
  process.stderr.write('\n  usage: npx tsx scripts/generate-expect-from-manifest.ts <feature>\n\n');
  process.exit(2);
}

function quoteString(s: string): string {
  // Single-line strings become double-quoted JSON literals; multi-line ones
  // become template literals so we don't have to escape newlines.
  if (s.includes('\n')) return '`' + s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
  return JSON.stringify(s);
}

function sentenceFor(step: Step): string {
  if (step.description) return step.description;
  switch (step.action) {
    case 'navigate': return `the user is on the ${step.to} page`;
    case 'click': return `the user clicks ${step.locator}`;
    case 'type': return `the user types into ${step.locator}`;
    case 'expect_visible': return `${step.locator} is visible to the user`;
    case 'expect_text': return `${step.locator} reads exactly "${step.text}"`;
    case 'expect_text_contains': return `${step.locator} contains the text "${step.substring}"`;
    case 'expect_text_grows': return `${step.locator} streams content -- its text grows over time`;
    case 'expect_count_at_least': return `at least ${step.count} ${step.locator} element(s) are visible`;
    case 'feed_audio_fixture': return `an audio fixture (${step.fixture}) is piped to the microphone`;
    case 'escape_hatch': return step.reason ?? 'escape-hatch step executed';
  }
}

function render(feature: string, manifest: Manifest): string {
  const lines: string[] = [];
  lines.push(`// AUTO-GENERATED from features/${feature}/TEST-MANIFEST.yaml -- edit the manifest, not this file.`);
  lines.push(`// Regenerate: npx tsx scripts/generate-expect-from-manifest.ts ${feature}`);
  lines.push(`// Or via CLI:  ai-dev-kit manifest generate ${feature}`);
  lines.push('');
  lines.push(`export const EXPECT_FEATURE = ${quoteString(feature)};`);
  lines.push(`export const EXPECT_PLAN = [`);
  for (const flow of manifest.user_flows) {
    lines.push(`  {`);
    lines.push(`    name: ${quoteString(flow.name)},`);
    if (flow.description) lines.push(`    description: ${quoteString(flow.description)},`);
    lines.push(`    steps: [`);
    for (const step of flow.steps) {
      lines.push(`      ${quoteString(sentenceFor(step))},`);
    }
    lines.push(`    ],`);
    lines.push(`  },`);
  }
  lines.push(`];`);
  lines.push('');
  return lines.join('\n');
}

function main(): void {
  const feature = process.argv[2];
  if (!feature) usage();

  const manifestPath = join(CWD, 'features', feature, 'TEST-MANIFEST.yaml');
  if (!existsSync(manifestPath)) {
    process.stderr.write(`\n  TEST-MANIFEST.yaml not found at ${manifestPath}\n`);
    process.stderr.write(`  Seed one: ai-dev-kit manifest seed ${feature}\n\n`);
    process.exit(1);
  }

  const manifest = parseManifest(readFileSync(manifestPath, 'utf-8'));
  const out = render(feature, manifest);
  // MANIFEST_OUT_DIR lets check-manifest-drift redirect the emitted spec to
  // a tmpfile for byte-compare without touching tests/expect.
  const outBase = process.env.MANIFEST_OUT_DIR ?? join(CWD, 'tests');
  const outPath = join(outBase, 'expect', `${feature}.expect.ts`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, out);
  process.stdout.write(`[generate-expect] wrote ${outPath.replace(CWD + '/', '')}\n`);
}

main();
