'use client';

/**
 * /dev-kit/registries -- dynamic view of every vendor registry.
 *
 * Reads /api/dev-kit/registries (which reads .ai-dev-kit/registries/*.json).
 * Shows models, pricing, deprecations, and staleness per vendor. The layout
 * is intentionally collapsed into vendor cards so the page reads as a catalog
 * instead of a long wall of tables.
 */

import { useEffect, useMemo, useState } from 'react';

const REGISTRY_COLORS = {
  success: 'var(--signal-success)',
  warning: 'var(--signal-warning)',
  live: 'var(--signal-live)',
} as const;

const tint = (color: string, amount = 18) =>
  `color-mix(in oklch, ${color} ${amount}%, transparent)`;

interface ModelEntry {
  id: string;
  label?: string;
  description?: string;
  price_per_hour_usd?: number;
  input_price_per_million_usd?: number;
  output_price_per_million_usd?: number;
  price_per_million_chars_usd?: number;
  price_notes?: string;
  use_for?: string;
  context_window?: number;
  deprecated?: boolean;
}
interface Registry {
  vendor: string;
  label?: string;
  docs_root?: string;
  console_url?: string;
  validated_on: string;
  ageDays: number | null;
  stale: boolean;
  required_env?: string[];
  deprecations?: Array<{ pattern: string; deprecated_on: string; replacement: string; notes?: string }>;
  slots: Record<string, ModelEntry[]>;
  error?: string;
}

function priceCell(m: ModelEntry): string {
  if (m.price_per_hour_usd != null) return `$${m.price_per_hour_usd.toFixed(2)}/hr${m.price_notes ? ' ' + m.price_notes : ''}`;
  if (m.input_price_per_million_usd != null && m.output_price_per_million_usd != null) {
    return `$${m.input_price_per_million_usd.toFixed(2)} / $${m.output_price_per_million_usd.toFixed(2)} per 1M`;
  }
  if (m.price_per_million_chars_usd != null) return `$${m.price_per_million_chars_usd.toFixed(2)} per 1M chars`;
  return '—';
}

function freshnessLabel(reg: Registry): string {
  if (reg.ageDays == null) return reg.stale ? 'stale (unvalidated)' : 'fresh (unvalidated)';
  return reg.stale ? `stale (${reg.ageDays}d)` : `fresh (${reg.ageDays}d)`;
}

export default function RegistriesPage() {
  const [data, setData] = useState<{ registries: Registry[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dev-kit/registries', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(`${r.status}`)))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  const stats = useMemo(() => {
    const registries = data?.registries ?? [];
    const totalSlots = registries.reduce((sum, reg) => sum + Object.keys(reg.slots).length, 0);
    const models = registries.flatMap((reg) => Object.values(reg.slots).flat());
    return {
      registries: registries.length,
      slots: totalSlots,
      models: models.length,
      stale: registries.filter((reg) => reg.stale).length,
      deprecated: models.filter((model) => model.deprecated).length,
    };
  }, [data]);

  if (err) return <div style={{ padding: 24, color: 'var(--signal-live)' }}>Error: {err}</div>;
  if (!data) return <div style={{ padding: 24, color: 'var(--ink-200)' }}>Loading&hellip;</div>;

  if (data.registries.length === 0) {
    return (
      <main style={{ maxWidth: 1180 }}>
        <header style={{ marginBottom: 20 }}>
          <div style={{ color: 'var(--layers-mint)', fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            Registry library
          </div>
          <h1 style={{ fontSize: 28, margin: '10px 0 0', color: 'var(--ink-200)' }}>
            Vendor Registries
          </h1>
          <p style={{ color: 'var(--ink-200)', opacity: 0.6, marginTop: 8, maxWidth: 760, lineHeight: 1.6 }}>
            No vendor registries yet. Add one for each external API the project
            calls so the dashboard can force IDs, pricing, and deprecations.
          </p>
        </header>
        <pre style={{ background: 'var(--surface-panel)', color: 'var(--layers-mint)', padding: 16, borderRadius: 12, overflowX: 'auto', border: '1px solid var(--border-default)' }}>
{`ai-dev-kit registry add assemblyai
# in Claude Code:
@spec-enricher populate the assemblyai registry`}
        </pre>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1240 }}>
      <header
        style={{
          marginBottom: 20,
          padding: 20,
          border: '1px solid var(--border-default)',
          borderRadius: 18,
          background: 'var(--surface-panel)',
        }}
      >
        <div style={{ color: 'var(--layers-mint)', fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
          Registry library
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', marginTop: 8, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 30, margin: 0, color: 'var(--ink-200)' }}>Vendor Registries</h1>
            <p style={{ color: 'var(--ink-200)', opacity: 0.6, marginTop: 8, maxWidth: 820, lineHeight: 1.6 }}>
              Source of truth for valid model IDs, pricing, and deprecation
              patterns. The page is collapsed into vendor cards so it reads like a
              catalog instead of a wall of tables.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(92px, 1fr))', gap: 10 }}>
            {[
              { label: 'Vendors', value: stats.registries },
              { label: 'Slots', value: stats.slots },
              { label: 'Models', value: stats.models },
              { label: 'Stale', value: stats.stale },
            ].map((item) => (
              <div key={item.label} style={{ border: '1px solid var(--border-default)', borderRadius: 12, background: 'var(--surface-control)', padding: 12, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-200)', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.16em' }}>{item.label}</div>
                <div style={{ color: 'var(--ink-200)', fontSize: 22, fontWeight: 700, marginTop: 6 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 8px', borderRadius: 999, background: tint(REGISTRY_COLORS.success), color: REGISTRY_COLORS.success, border: `1px solid color-mix(in oklch, ${REGISTRY_COLORS.success} 30%, transparent)` }}>active registries</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 8px', borderRadius: 999, background: tint(REGISTRY_COLORS.warning), color: REGISTRY_COLORS.warning, border: `1px solid color-mix(in oklch, ${REGISTRY_COLORS.warning} 30%, transparent)` }}>{stats.deprecated} deprecated models</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 8px', borderRadius: 999, background: tint(REGISTRY_COLORS.live), color: REGISTRY_COLORS.live, border: `1px solid color-mix(in oklch, ${REGISTRY_COLORS.live} 30%, transparent)` }}>policy enforced</span>
        </div>
      </header>

      <div style={{ display: 'grid', gap: 16 }}>
        {data.registries.map((reg, index) => {
          const models = Object.values(reg.slots).flat();
          const slotNames = Object.keys(reg.slots);

          return (
            <details
              key={reg.vendor}
              open={index === 0}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 18,
                background: 'var(--layers-surface)',
                overflow: 'hidden',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  listStyle: 'none',
                  padding: 20,
                  outline: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 20, margin: 0, color: 'var(--ink-200)' }}>{reg.label ?? reg.vendor}</h2>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: reg.stale ? tint(REGISTRY_COLORS.warning) : tint(REGISTRY_COLORS.success),
                          color: reg.stale ? REGISTRY_COLORS.warning : REGISTRY_COLORS.success,
                          border: `1px solid color-mix(in oklch, ${reg.stale ? REGISTRY_COLORS.warning : REGISTRY_COLORS.success} 26%, transparent)`,
                        }}
                      >
                        {freshnessLabel(reg)}
                      </span>
                    </div>
                    <p style={{ color: 'var(--ink-200)', opacity: 0.6, marginTop: 8, marginBottom: 0, maxWidth: 820, lineHeight: 1.6 }}>
                      {reg.vendor} • {models.length} models across {slotNames.length} slots • validated {reg.validated_on || 'not recorded'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                    {reg.docs_root && (
                      <a
                        href={reg.docs_root}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--ink-200)', textDecoration: 'none', border: '1px solid var(--border-default)', background: 'var(--surface-control)', borderRadius: 999, padding: '6px 10px', fontSize: 12 }}
                      >
                        docs
                      </a>
                    )}
                    {reg.console_url && (
                      <a
                        href={reg.console_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--ink-200)', textDecoration: 'none', border: '1px solid var(--border-default)', background: 'var(--surface-control)', borderRadius: 999, padding: '6px 10px', fontSize: 12 }}
                      >
                        console
                      </a>
                    )}
                  </div>
                </div>

                {reg.required_env && reg.required_env.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {reg.required_env.map((key) => (
                      <code
                        key={key}
                        style={{
                          background: 'var(--surface-control)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--ink-200)',
                          opacity: 0.7,
                          padding: '3px 8px',
                          borderRadius: 999,
                          fontSize: 11,
                        }}
                      >
                        {key}
                      </code>
                    ))}
                  </div>
                )}
              </summary>

              <div style={{ padding: '0 20px 20px' }}>
                {reg.deprecations && reg.deprecations.length > 0 && (
                  <div
                    style={{
                      border: '1px solid var(--border-default)',
                      borderRadius: 12,
                      background: 'color-mix(in oklch, var(--surface-control) 92%, var(--signal-warning) 8%)',
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-200)', marginBottom: 8 }}>
                      Deprecations
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {reg.deprecations.map((dep) => (
                        <div key={`${dep.pattern}-${dep.deprecated_on}`} style={{ color: 'var(--ink-200)', opacity: 0.72, fontSize: 13, lineHeight: 1.5 }}>
                          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-200)' }}>{dep.pattern}</code>
                          {' '}→ <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-200)' }}>{dep.replacement}</code>
                          {' '}({dep.deprecated_on})
                          {dep.notes ? ` — ${dep.notes}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 12 }}>
                  {Object.entries(reg.slots).map(([slotName, slotModels], slotIndex) => (
                    <details
                      key={slotName}
                      open={slotIndex === 0}
                      style={{
                        border: '1px solid var(--border-default)',
                        borderRadius: 12,
                        background: 'var(--surface-control)',
                        overflow: 'hidden',
                      }}
                    >
                      <summary
                        style={{
                          cursor: 'pointer',
                          listStyle: 'none',
                          padding: 12,
                          outline: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-200)' }}>
                              {slotName.replace('_models', ' models').replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ink-200)', opacity: 0.45, marginTop: 4 }}>
                              {slotModels.length} models in this lane
                            </div>
                          </div>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: tint(REGISTRY_COLORS.success),
                            color: REGISTRY_COLORS.success,
                            border: `1px solid color-mix(in oklch, ${REGISTRY_COLORS.success} 26%, transparent)`,
                          }}>
                            registry-backed
                          </span>
                        </div>
                      </summary>

                      <div style={{ overflowX: 'auto', padding: '0 12px 12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
                          <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--ink-200)', opacity: 0.45, borderBottom: '1px solid var(--border-default)' }}>
                              <th style={{ padding: '10px 8px' }}>ID</th>
                              <th style={{ padding: '10px 8px' }}>Pricing</th>
                              <th style={{ padding: '10px 8px' }}>Use for</th>
                              <th style={{ padding: '10px 8px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slotModels.map((model) => (
                              <tr key={model.id} style={{ borderBottom: '1px solid var(--border-default)', opacity: model.deprecated ? 0.55 : 1 }}>
                                <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: 'var(--ink-200)' }}>{model.id}</td>
                                <td style={{ padding: '10px 8px', color: 'var(--ink-200)', opacity: 0.7 }}>{priceCell(model)}</td>
                                <td style={{ padding: '10px 8px', color: 'var(--ink-200)', opacity: 0.7 }}>{model.use_for ?? '—'}</td>
                                <td style={{ padding: '10px 8px' }}>
                                  <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 11,
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    background: model.deprecated ? tint(REGISTRY_COLORS.live) : tint(REGISTRY_COLORS.success),
                                    color: model.deprecated ? REGISTRY_COLORS.live : REGISTRY_COLORS.success,
                                    border: `1px solid color-mix(in oklch, ${model.deprecated ? REGISTRY_COLORS.live : REGISTRY_COLORS.success} 26%, transparent)`,
                                  }}>
                                    {model.deprecated ? 'deprecated' : 'active'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}
