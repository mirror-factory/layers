import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const path = join(process.cwd(), '.ai-dev-kit', 'registries', 'dependencies.yaml');
  if (!existsSync(path)) {
    return NextResponse.json({ status: 'not_configured', hint: 'Run `pnpm exec tsx scripts/sync-dependencies.ts`' }, { status: 200 });
  }
  return NextResponse.json({ status: 'ok', yaml: readFileSync(path, 'utf-8') });
}
