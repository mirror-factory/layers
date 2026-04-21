import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const path = join(process.cwd(), '.ai-dev-kit', 'registries', 'index.yaml');
  if (!existsSync(path)) {
    return NextResponse.json({ status: 'not_configured', hint: 'Run `pnpm exec tsx scripts/sync-project-index.ts`' }, { status: 200 });
  }
  const src = readFileSync(path, 'utf-8');
  return NextResponse.json({ status: 'ok', yaml: src });
}
