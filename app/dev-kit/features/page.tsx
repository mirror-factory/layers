/**
 * /dev-kit/features -- list every registered feature-proof contract.
 *
 * Click a row to drill into /dev-kit/features/[name].
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Feature {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  userFacing: boolean | null;
  surfaces: string[];
  routes: string[];
  proof: string[];
  source: string;
  specExists: boolean;
  designReady: boolean;
  manifestExists: boolean;
  flows: number;
}

export default function FeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/dev-kit/features').then(r => r.json()).then(d => { setFeatures(d.features ?? []); setLoading(false); });
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui', minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      <h1>Features</h1>
      <p style={{ color: '#94a3b8' }}>Feature contracts come from the proof registry that maps changed files to required lanes.</p>
      {loading ? <p>Loading...</p> : features.length === 0 ? (
        <div style={{ padding: 24, border: '1px dashed #333', marginTop: 20 }}>
          <p>No registered features yet.</p>
          <p style={{ color: '#94a3b8' }}>Add feature contracts in <code>.ai-dev-kit/registries/feature-proof.json</code>.</p>
        </div>
      ) : (
        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Feature</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Surfaces</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Routes</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Proof</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333' }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {features.map(f => (
              <tr key={f.id}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>
                  <Link href={`/dev-kit/features/${encodeURIComponent(f.id)}`}>{f.name}</Link>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{f.id}</div>
                  {f.description ? <div style={{ color: '#94a3b8', fontSize: 12 }}>{f.description}</div> : null}
                </td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>{f.status || 'unknown'}{f.userFacing === true ? ' / user-facing' : ''}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>{f.surfaces.join(', ') || 'n/a'}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>{f.routes.join(', ') || 'n/a'}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>{f.proof.join(', ') || 'none'}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #222' }}>{f.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
