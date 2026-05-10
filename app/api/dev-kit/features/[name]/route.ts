import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ name: string }> }

type RegistryFeature = {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  status?: string;
  userFacing?: boolean;
  surfaces?: string[];
  routes?: string[];
  paths?: string[];
  proof?: string[];
  tests?: Record<string, string[]>;
  notes?: string[];
};

function read(path: string): string | null {
  if (!existsSync(path)) return null;
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

function readJson<T>(path: string): T | null {
  const src = read(path);
  if (!src) return null;
  try { return JSON.parse(src) as T; } catch { return null; }
}

export async function GET(_req: Request, context: Params) {
  const { name } = await context.params;
  const root = process.cwd();
  const dir = join(root, 'features', name);
  const registryPath = join(root, '.ai-dev-kit', 'registries', 'feature-proof.json');
  const registry = readJson<{ features?: RegistryFeature[]; proofLanes?: Record<string, unknown> }>(registryPath);
  const registryFeature = (registry?.features ?? []).find(feature =>
    feature.id === name || feature.name === name
  ) ?? null;

  return NextResponse.json({
    id: registryFeature?.id ?? name,
    name: registryFeature?.name ?? name,
    description: registryFeature?.description ?? '',
    category: registryFeature?.category ?? '',
    status: registryFeature?.status ?? '',
    userFacing: registryFeature?.userFacing ?? null,
    surfaces: registryFeature?.surfaces ?? [],
    routes: registryFeature?.routes ?? [],
    paths: registryFeature?.paths ?? [],
    proof: registryFeature?.proof ?? [],
    tests: registryFeature?.tests ?? {},
    notes: registryFeature?.notes ?? [],
    source: registryFeature ? 'feature-proof-registry' : 'features-folder',
    availableProofLanes: registry?.proofLanes ?? {},
    spec: read(join(dir, 'SPEC.md')),
    ia: read(join(dir, 'IA.md')),
    manifest: read(join(dir, 'TEST-MANIFEST.yaml')),
    design_ready: existsSync(join(dir, 'DESIGN-READY.md')),
  });
}
