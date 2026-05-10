#!/usr/bin/env tsx
/**
 * Focused ticket proof.
 *
 * Maps touched files to the smallest useful verification set. This gives
 * Symphony and humans one command to run before asking for review.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

interface CommandSpec {
  name: string;
  command: string;
  needsBrowser?: boolean;
}

interface CommandResult extends CommandSpec {
  pass: boolean;
  exitCode: number;
  durationMs: number;
}

const cwd = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const evidenceDir = join(cwd, '.evidence');
let browserReady = false;

function canInstallSystemDeps(): boolean {
  if (typeof process.getuid === 'function' && process.getuid() === 0) return true;
  const result = spawnSync('sudo', ['-n', 'true'], { cwd, stdio: 'ignore' });
  return result.status === 0;
}

function runGit(args: string[]): string[] {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) return [];
  return result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function gitOk(args: string[]): boolean {
  return spawnSync('git', args, { cwd, encoding: 'utf-8' }).status === 0;
}

function unique(items: string[]): string[] {
  return [...new Set(items)].sort();
}

function changedFiles(): string[] {
  if (process.env.TICKET_FILES) {
    return unique(process.env.TICKET_FILES.split(/[\n, ]+/).map(file => file.trim()).filter(Boolean));
  }

  const workingTreeFiles = [
    ...runGit(['diff', '--name-only']),
    ...runGit(['diff', '--name-only', '--cached']),
  ];
  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])[0];
  const branchBases = unique([
    upstream,
    gitOk(['rev-parse', '--verify', 'origin/development']) ? 'origin/development' : '',
  ].filter(Boolean));
  const branchFiles = branchBases.length > 0
    ? branchBases.flatMap(ref => runGit(['diff', '--name-only', `${ref}...HEAD`]))
    : runGit(['diff', '--name-only', 'origin/main...HEAD']);

  return unique([...workingTreeFiles, ...branchFiles]);
}

function has(path: string): boolean {
  return existsSync(join(cwd, path));
}

function componentVisualSpec(file: string): string | null {
  if (!file.startsWith('components/') || !file.endsWith('.tsx')) return null;
  const name = basename(file).replace(/\.tsx$/, '');
  const candidate = `tests/e2e/${name}.visual.spec.ts`;
  return has(candidate) ? candidate : null;
}

function commandSetFor(files: string[]): CommandSpec[] {
  const commands: CommandSpec[] = [
    { name: 'feature proof plan', command: 'pnpm test:feature-proof' },
    { name: 'fast deterministic tests', command: 'pnpm test:fast' },
  ];

  const touchesApi = files.some(file => file.startsWith('app/api/') || file.includes('/api/'));
  const touchesUi = files.some(file =>
    file.endsWith('.tsx') ||
    file.startsWith('app/') ||
    file.startsWith('components/') ||
    file.startsWith('styles/') ||
    file === 'tests/e2e/smoke.spec.ts' ||
    file === 'DESIGN.md'
  );
  const touchesMobile = files.some(file =>
    file.includes('mobile') ||
    file.includes('layout') ||
    file.includes('navigation') ||
    file.includes('nav') ||
    file.startsWith('app/')
  );
  const touchesAiTooling = files.some(file =>
    file.startsWith('lib/ai') ||
    file.startsWith('lib/tools') ||
    file.startsWith('tests/evals') ||
    file.includes('tool')
  );

  if (touchesApi && has('tests/route-contracts.test.ts')) {
    commands.push({ name: 'route contracts', command: 'pnpm test:contracts' });
  }

  if (touchesAiTooling && has('vitest.eval.config.ts')) {
    commands.push({ name: 'AI/tool eval stubs', command: 'pnpm test:eval' });
  }

  const visualSpecs = unique(files.map(componentVisualSpec).filter((file): file is string => Boolean(file)));
  for (const spec of visualSpecs) {
    commands.push({
      name: `component visual proof: ${spec}`,
      command: `PLAYWRIGHT_FORCE_CHROMIUM=1 PLAYWRIGHT_DISABLE_VIDEO=1 npx playwright test ${spec} --project=desktop-light --project=mobile-light`,
      needsBrowser: true,
    });
  }

  if (touchesUi && has('tests/e2e/smoke.spec.ts')) {
    commands.push({
      name: 'route smoke proof',
      command: 'PLAYWRIGHT_FORCE_CHROMIUM=1 PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/smoke.spec.ts --project=desktop-light --project=mobile-light --workers=1',
      needsBrowser: true,
    });
  }

  if (touchesMobile && has('tests/e2e/mobile.spec.ts')) {
    commands.push({
      name: 'mobile proof',
      command: 'PLAYWRIGHT_FORCE_CHROMIUM=1 PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/mobile.spec.ts --project=mobile-light --workers=1',
      needsBrowser: true,
    });
  }

  return uniqueCommands(commands);
}

function uniqueCommands(commands: CommandSpec[]): CommandSpec[] {
  const seen = new Set<string>();
  const out: CommandSpec[] = [];
  for (const command of commands) {
    if (seen.has(command.command)) continue;
    seen.add(command.command);
    out.push(command);
  }
  return out;
}

function ensureBrowser(): CommandResult | null {
  if (browserReady || dryRun) return null;
  const withDeps = canInstallSystemDeps();

  const install: CommandSpec = {
    name: 'Playwright Chromium install',
    command: withDeps ? 'npx playwright install --with-deps chromium' : 'npx playwright install chromium',
  };
  const result = runCommand(install);
  if (result.pass) browserReady = true;
  return result;
}

function runCommand(spec: CommandSpec): CommandResult {
  const start = Date.now();
  console.log(`\n[verify-ticket] ${spec.name}`);
  console.log(`$ ${spec.command}`);

  if (dryRun) {
    return { ...spec, pass: true, exitCode: 0, durationMs: Date.now() - start };
  }

  const result = spawnSync(spec.command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  return {
    ...spec,
    pass: exitCode === 0,
    exitCode,
    durationMs: Date.now() - start,
  };
}

function main() {
  const files = changedFiles();
  const commands = commandSetFor(files);
  const results: CommandResult[] = [];

  console.log(`[verify-ticket] changed files: ${files.length}`);
  for (const file of files.slice(0, 40)) console.log(`  - ${file}`);
  if (files.length > 40) console.log(`  - ...${files.length - 40} more`);

  for (const command of commands) {
    if (command.needsBrowser) {
      const installResult = ensureBrowser();
      if (installResult) {
        results.push(installResult);
        if (!installResult.pass) break;
      }
    }
    const result = runCommand(command);
    results.push(result);
    if (!result.pass) break;
  }

  mkdirSync(evidenceDir, { recursive: true });
  const payload = {
    runAt: new Date().toISOString(),
    pass: results.every(result => result.pass),
    changedFiles: files,
    results,
  };
  const out = join(evidenceDir, 'ticket-proof.json');
  writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
  console.log(`[verify-ticket] wrote ${out}`);

  if (!payload.pass) process.exit(1);
}

main();
