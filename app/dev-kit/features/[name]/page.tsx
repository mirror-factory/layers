/**
 * /dev-kit/features/[name] -- single feature drill-down.
 *
 * Shows proof-registry metadata alongside legacy SPEC/IA/TEST-MANIFEST files.
 */
'use client';
import { useEffect, useState } from 'react';

interface Data {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  userFacing: boolean | null;
  surfaces: string[];
  routes: string[];
  paths: string[];
  proof: string[];
  tests: Record<string, string[]>;
  notes: string[];
  source: string;
  spec: string | null;
  ia: string | null;
  manifest: string | null;
  design_ready: boolean;
}

export default function FeaturePage({ params }: { params: Promise<{ name: string }> }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    (async () => {
      const p = await params;
      const res = await fetch(`/api/dev-kit/features/${p.name}`);
      setData(await res.json());
    })();
  }, [params]);

  if (!data) return <main style={{ padding: 24, color: '#fafafa', background: '#0a0a0a', minHeight: '100vh' }}>Loading...</main>;

  return (
    <main style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui', minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      <h1>{data.name}</h1>
      <p style={{ color: '#94a3b8' }}>{data.id} · {data.source} · {data.status || 'unknown'}{data.userFacing === true ? ' · user-facing' : ''}</p>
      {data.description ? <p style={{ color: '#94a3b8', maxWidth: 900 }}>{data.description}</p> : null}
      <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ border: '1px solid #333', borderRadius: 6, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Proof lanes</h2>
          <p>{data.proof.join(', ') || 'none'}</p>
        </div>
        <div style={{ border: '1px solid #333', borderRadius: 6, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Surfaces</h2>
          <p>{data.surfaces.join(', ') || 'n/a'}</p>
        </div>
        <div style={{ border: '1px solid #333', borderRadius: 6, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Routes</h2>
          <p>{data.routes.join(', ') || 'n/a'}</p>
        </div>
        <div style={{ border: '1px solid #333', borderRadius: 6, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Category</h2>
          <p>{data.category || 'n/a'}</p>
        </div>
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>Changed-file paths</h2>
        {data.paths.length ? <pre style={{ background: '#141414', padding: 12, borderRadius: 4, overflow: 'auto' }}>{data.paths.join('\n')}</pre> : <p style={{ color: '#94a3b8' }}>No paths registered.</p>}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>Tests</h2>
        {Object.keys(data.tests).length ? <pre style={{ background: '#141414', padding: 12, borderRadius: 4, overflow: 'auto' }}>{JSON.stringify(data.tests, null, 2)}</pre> : <p style={{ color: '#94a3b8' }}>No tests registered.</p>}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>Notes</h2>
        {data.notes.length ? <ul>{data.notes.map(note => <li key={note}>{note}</li>)}</ul> : <p style={{ color: '#94a3b8' }}>No notes.</p>}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>SPEC.md</h2>
        {data.spec ? <pre style={{ background: '#141414', padding: 12, borderRadius: 4, overflow: 'auto' }}>{data.spec}</pre> : <p style={{ color: '#94a3b8' }}>Not present.</p>}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>IA.md</h2>
        {data.ia ? <pre style={{ background: '#141414', padding: 12, borderRadius: 4, overflow: 'auto' }}>{data.ia}</pre> : <p style={{ color: '#94a3b8' }}>Not present.</p>}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>TEST-MANIFEST.yaml</h2>
        {data.manifest ? <pre style={{ background: '#141414', padding: 12, borderRadius: 4, overflow: 'auto' }}>{data.manifest}</pre> : <p style={{ color: '#94a3b8' }}>Not present. Run: <code>ai-dev-kit manifest seed {data.name}</code></p>}
      </section>
    </main>
  );
}
