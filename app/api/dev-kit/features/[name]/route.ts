import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ name: string }> }

function read(path: string): string | null {
  if (!existsSync(path)) return null;
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

export async function GET(_req: Request, context: Params) {
  const { name } = await context.params;
  const root = process.cwd();
  const dir = join(root, 'features', name);

  return NextResponse.json({
    name,
    spec: read(join(dir, 'SPEC.md')),
    ia: read(join(dir, 'IA.md')),
    manifest: read(join(dir, 'TEST-MANIFEST.yaml')),
    design_ready: existsSync(join(dir, 'DESIGN-READY.md')),
  });
}
