import { NextResponse } from 'next/server';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

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
};

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function countFlows(manifestPath: string): number {
  if (!existsSync(manifestPath)) return 0;
  const manifestSrc = readFileSync(manifestPath, 'utf-8');
  return (manifestSrc.match(/^\s+-\s+name:\s/gm) || []).length;
}

export async function GET() {
  const root = process.cwd();
  const registryPath = join(root, '.ai-dev-kit', 'registries', 'feature-proof.json');
  const registry = readJson<{ features?: RegistryFeature[] }>(registryPath);
  const dir = join(root, 'features');
  const registryFeatures = (registry?.features ?? []).map(feature => ({
    id: feature.id,
    name: feature.name ?? feature.id,
    description: feature.description ?? '',
    category: feature.category ?? 'uncategorized',
    status: feature.status ?? 'unknown',
    userFacing: feature.userFacing ?? null,
    surfaces: feature.surfaces ?? [],
    routes: feature.routes ?? [],
    paths: feature.paths ?? [],
    proof: feature.proof ?? [],
    tests: feature.tests ?? {},
    source: 'feature-proof-registry',
    specExists: false,
    designReady: false,
    manifestExists: false,
    flows: 0,
  }));

  const folderFeatures = existsSync(dir)
    ? readdirSync(dir).filter(n => !n.startsWith('_') && statSync(join(dir, n)).isDirectory())
    : [];
  const folderOut = folderFeatures.map(name => {
    const fdir = join(dir, name);
    const specExists = existsSync(join(fdir, 'SPEC.md'));
    const designReady = existsSync(join(fdir, 'DESIGN-READY.md'));
    const manifestPath = join(fdir, 'TEST-MANIFEST.yaml');
    const manifestExists = existsSync(manifestPath);
    return {
      id: name,
      name,
      description: '',
      category: 'folder-spec',
      status: 'draft',
      userFacing: null,
      surfaces: [],
      routes: [],
      paths: [],
      proof: [],
      tests: {},
      source: 'features-folder',
      specExists,
      designReady,
      manifestExists,
      flows: countFlows(manifestPath),
    };
  });

  const seen = new Set(registryFeatures.map(feature => feature.id));
  const out = [
    ...registryFeatures,
    ...folderOut.filter(feature => !seen.has(feature.id)),
  ].sort((a, b) => a.id.localeCompare(b.id));

  return NextResponse.json({ features: out });
}
