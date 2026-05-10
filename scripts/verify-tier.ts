#!/usr/bin/env tsx
/**
 * Tiered verification runner for humans, CI, and Symphony.
 *
 * The goal is to make the harness cheap at the inner loop and expensive only
 * when the workflow explicitly asks for broader proof.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type TierId = '0' | '1' | '2' | '3' | '4' | '5';

interface CommandSpec {
  name: string;
  command: string;
  required?: boolean;
  when?: () => boolean;
}

interface CommandResult {
  name: string;
  command: string;
  required: boolean;
  skipped: boolean;
  pass: boolean;
  exitCode: number | null;
  durationMs: number;
}

interface TierSpec {
  id: TierId;
  label: string;
  description: string;
  commands: CommandSpec[];
}

const cwd = process.cwd();
const evidenceDir = join(cwd, '.evidence');

function has(path: string): boolean {
  return existsSync(join(cwd, path));
}

const tiers: Record<TierId, TierSpec> = {
  '0': {
    id: '0',
    label: 'Local syntax and structure',
    description: 'Cheap checks for immediate feedback before a commit.',
    commands: [
      { name: 'project profile', command: 'npx tsx scripts/validate-project-profile.ts', when: () => has('scripts/validate-project-profile.ts') },
      { name: 'typecheck', command: 'pnpm typecheck' },
      { name: 'registry strings', command: 'npx tsx scripts/check-registry-strings.ts', when: () => has('scripts/check-registry-strings.ts') },
      { name: 'deprecations', command: 'npx tsx scripts/check-deprecations.ts', when: () => has('scripts/check-deprecations.ts') },
    ],
  },
  '1': {
    id: '1',
    label: 'Fast deterministic tests',
    description: 'Agent and pre-push oracle: no browser, no live AI browser proof.',
    commands: [
      { name: 'fast tests', command: 'pnpm test:fast' },
      { name: 'feature proof plan', command: 'pnpm test:feature-proof', when: () => has('scripts/resolve-feature-proof.ts') },
      { name: 'manifest drift', command: 'npx tsx scripts/check-manifest-drift.ts', when: () => has('scripts/check-manifest-drift.ts') },
      { name: 'compliance', command: 'npx tsx scripts/check-compliance.ts', when: () => has('scripts/check-compliance.ts') },
      { name: 'expect coverage', command: 'npx tsx scripts/check-expect-coverage.ts', when: () => has('scripts/check-expect-coverage.ts') },
      { name: 'budget', command: 'npx tsx scripts/check-budget.ts', when: () => has('scripts/check-budget.ts') && has('.ai-dev-kit/budget.yaml') },
    ],
  },
  '2': {
    id: '2',
    label: 'Focused ticket proof',
    description: 'Touched-file mapped proof before PR review or Symphony handoff.',
    commands: [
      { name: 'ticket proof', command: 'npx tsx scripts/verify-ticket.ts', when: () => has('scripts/verify-ticket.ts') },
    ],
  },
  '3': {
    id: '3',
    label: 'Visual, mobile, usability, and staging',
    description: 'Browser-heavy checks for UI confidence and staging validation.',
    commands: [
      { name: 'mobile visual matrix', command: 'PLAYWRIGHT_FORCE_CHROMIUM=1 pnpm exec playwright test tests/e2e/*.visual.spec.ts tests/e2e/*.visual.test.ts tests/e2e/visual-regression.spec.ts --project=mobile-light --project=mobile-dark --output=test-results/tier-3/mobile-visual' },
      { name: 'desktop visual matrix', command: 'pnpm exec playwright test tests/e2e/*.visual.spec.ts tests/e2e/*.visual.test.ts tests/e2e/visual-regression.spec.ts --project=desktop-light --project=desktop-dark --output=test-results/tier-3/desktop-visual' },
      { name: 'mobile flows', command: 'PLAYWRIGHT_FORCE_CHROMIUM=1 pnpm exec playwright test tests/e2e/mobile.spec.ts --project=mobile-light --output=test-results/tier-3/mobile-flows' },
      { name: 'expect AI browser proof', command: 'pnpm test:expect', when: () => has('scripts/run-expect-proof.ts') },
      { name: 'feature proof artifacts', command: 'pnpm test:feature-proof -- --enforce-artifacts', when: () => has('scripts/resolve-feature-proof.ts') },
      { name: 'design drift', command: 'npx tsx scripts/check-design-drift.ts', when: () => has('scripts/check-design-drift.ts') },
    ],
  },
  '4': {
    id: '4',
    label: 'Background regression and drift',
    description: 'Nightly dependency, eval, docs, and live-integration checks.',
    commands: [
      { name: 'dependencies', command: 'npx tsx scripts/check-dependencies.ts', when: () => has('scripts/check-dependencies.ts') },
      { name: 'million optimization check', command: 'npx tsx scripts/check-million.ts', when: () => has('scripts/check-million.ts') },
      { name: 'evals', command: 'pnpm test:eval' },
      { name: 'live integrations', command: 'pnpm test:live', required: false },
      { name: 'doctor strict', command: 'pnpm dev-kit:doctor:strict', required: false },
      { name: 'docs lookup coverage', command: 'npx tsx scripts/check-docs-lookup-coverage.ts', when: () => has('scripts/check-docs-lookup-coverage.ts') },
    ],
  },
  '5': {
    id: '5',
    label: 'Release and native artifact proof',
    description: 'Release-tag proof for web, native shells, and public assets.',
    commands: [
      { name: 'runner capability', command: 'pnpm runner:doctor', when: () => has('scripts/check-runner-capability.ts') },
      { name: 'native config', command: 'pnpm test:native:config', when: () => has('scripts/check-native-config.ts') },
      { name: 'native smoke', command: 'pnpm test:native:smoke', when: () => has('scripts/run-native-smoke.ts') },
      { name: 'native build', command: 'pnpm build:native', when: () => has('scripts/run-native-build.ts') },
      { name: 'release artifacts', command: 'pnpm build:release', when: () => has('scripts/check-release-artifacts.ts') },
      { name: 'download smoke', command: 'PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/app-download-page.smoke.spec.ts --project=desktop-light' },
    ],
  },
};

function usage(): never {
  console.error('usage: npx tsx scripts/verify-tier.ts [0..5 ...] [--dry-run] [--continue] [--list]');
  process.exit(2);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const continueOnFailure = args.includes('--continue');
  const list = args.includes('--list');
  const tierArgs = args.filter(arg => !arg.startsWith('--'));
  const selected = tierArgs.length > 0 ? tierArgs : ['0', '1'];

  for (const tier of selected) {
    if (!(tier in tiers)) usage();
  }

  return {
    dryRun,
    continueOnFailure,
    list,
    selected: selected as TierId[],
  };
}

function runCommand(spec: CommandSpec, dryRun: boolean): CommandResult {
  const required = spec.required !== false;
  const shouldRun = spec.when ? spec.when() : true;
  const start = Date.now();

  if (!shouldRun) {
    return {
      name: spec.name,
      command: spec.command,
      required,
      skipped: true,
      pass: true,
      exitCode: null,
      durationMs: Date.now() - start,
    };
  }

  console.log(`\n[verify-tier] ${spec.name}`);
  console.log(`$ ${spec.command}`);

  if (dryRun) {
    return {
      name: spec.name,
      command: spec.command,
      required,
      skipped: true,
      pass: true,
      exitCode: null,
      durationMs: Date.now() - start,
    };
  }

  const result = spawnSync(spec.command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  const pass = exitCode === 0 || !required;

  return {
    name: spec.name,
    command: spec.command,
    required,
    skipped: false,
    pass,
    exitCode,
    durationMs: Date.now() - start,
  };
}

function writeEvidence(tier: TierSpec, results: CommandResult[]) {
  mkdirSync(evidenceDir, { recursive: true });
  const payload = {
    tier: tier.id,
    label: tier.label,
    description: tier.description,
    runAt: new Date().toISOString(),
    pass: results.every(result => result.pass),
    results,
  };
  const file = join(evidenceDir, `tier-${tier.id}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
  writeFileSync(join(evidenceDir, 'tier-latest.json'), JSON.stringify(payload, null, 2) + '\n');
  console.log(`[verify-tier] wrote ${file}`);
}

function main() {
  const { dryRun, continueOnFailure, list, selected } = parseArgs();

  if (list) {
    for (const tier of Object.values(tiers)) {
      console.log(`Tier ${tier.id}: ${tier.label}`);
      for (const command of tier.commands) console.log(`  - ${command.command}`);
    }
    return;
  }

  let failed = false;

  for (const tierId of selected) {
    const tier = tiers[tierId];
    console.log(`\n[verify-tier] Tier ${tier.id}: ${tier.label}`);
    const results: CommandResult[] = [];

    for (const command of tier.commands) {
      const result = runCommand(command, dryRun);
      results.push(result);

      if (!result.pass) {
        failed = true;
        if (!continueOnFailure) break;
      }
    }

    writeEvidence(tier, results);
    const pass = results.every(result => result.pass);
    console.log(`[verify-tier] Tier ${tier.id} ${pass ? 'passed' : 'failed'}`);

    if (!pass && !continueOnFailure) break;
  }

  if (failed) process.exit(1);
}

main();
