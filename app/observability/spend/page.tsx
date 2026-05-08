'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildSpendCapBurnRows } from '@/lib/spend-caps';

interface StatsResponse {
  costByDay?: Record<string, number>;
}

const money = (value: number) =>
  value === 0 ? '$0.00' : value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;

const pct = (value: number) => `${value.toFixed(1)}%`;

export default function SpendObservabilityPage() {
  const [aiGatewayDailyUsd, setAiGatewayDailyUsd] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const response = await fetch('/api/ai-logs/stats');
        if (!response.ok) return;
        const stats = (await response.json()) as StatsResponse;
        const latestDay = Object.keys(stats.costByDay ?? {}).sort().at(-1);
        if (!cancelled) setAiGatewayDailyUsd(latestDay ? stats.costByDay?.[latestDay] ?? 0 : 0);
      } catch {
        if (!cancelled) setAiGatewayDailyUsd(0);
      }
    }

    void loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const rows = useMemo(
    () => buildSpendCapBurnRows({ aiGatewayDailyUsd }),
    [aiGatewayDailyUsd],
  );

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--layers-ink)',
      color: 'var(--ink-200)',
      padding: '24px clamp(16px, 4vw, 40px)',
      fontFamily: "'SF Mono', 'Fira Code', ui-monospace, monospace",
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--layers-mint-soft)', fontSize: 22 }}>Vendor Burn</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-500)', fontSize: 12 }}>
            Daily external dependency spend sorted by percent of cap.
          </p>
        </div>
        <div style={{ color: 'var(--layers-blue-soft)', fontSize: 12 }}>
          Alerts: support@mirrorfactory.ai
        </div>
      </header>

      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        {[
          ['Tracked vendors', rows.length.toString(), 'var(--layers-mint-soft)'],
          ['At or above 80%', rows.filter((row) => row.status === 'watch' || row.status === 'critical').length.toString(), 'var(--signal-warning)'],
          ['AI Gateway today', money(aiGatewayDailyUsd), 'var(--signal-warning)'],
          ['Cap owner', 'founder', 'var(--layers-blue-soft)'],
        ].map(([label, value, color]) => (
          <div key={label} style={{
            background: 'color-mix(in oklch, var(--layers-ink) 91%, var(--layers-mint) 9%)',
            border: '1px solid color-mix(in oklch, var(--layers-mint) 22%, transparent)',
            borderRadius: 8,
            padding: 14,
          }}>
            <div style={{ color: 'var(--ink-500)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ color, fontSize: 20, fontWeight: 700, marginTop: 5, wordBreak: 'break-word' }}>{value}</div>
          </div>
        ))}
      </section>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid color-mix(in oklch, var(--layers-mint) 22%, transparent)' }}>
              {['Vendor', 'Daily burn', '% cap', 'Monthly cap', 'Alerts', 'Owner', 'Source', 'Kill-switch'].map((heading) => (
                <th key={heading} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--ink-500)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const risk = Math.max(row.percentOfMonthlyCap ?? 0, row.percentOfDailyCap ?? 0);
              const tone = row.status === 'critical'
                ? 'var(--signal-live)'
                : row.status === 'watch'
                  ? 'var(--signal-warning)'
                  : row.status === 'uncapped'
                    ? 'var(--layers-violet-soft)'
                    : 'var(--signal-success)';

              return (
                <tr key={row.id} style={{ borderBottom: '1px solid color-mix(in oklch, var(--layers-mint) 12%, transparent)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700 }}>{row.vendor}</div>
                    <div style={{ color: 'var(--ink-500)', fontSize: 11, marginTop: 3 }}>{row.scope}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--signal-warning)', fontWeight: 700 }}>{money(row.dailyBurnUsd)}</td>
                  <td style={{ padding: '10px 12px', color: tone, fontWeight: 700 }}>
                    {row.percentOfMonthlyCap == null && row.percentOfDailyCap == null ? 'n/a' : pct(risk)}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink-400)' }}>
                    {row.monthlyCapUsd == null ? 'n/a' : row.monthlyCapUsd === 0 ? '$0 tier cap' : money(row.monthlyCapUsd)}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--layers-blue-soft)' }}>
                    {row.alertThresholds.join('/')}%<br />
                    <span style={{ color: 'var(--ink-500)', fontSize: 11 }}>{row.alertChannel}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink-400)' }}>{row.owner}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--ink-400)', maxWidth: 220 }}>{row.burnSource}</td>
                  <td style={{ padding: '10px 12px', maxWidth: 320 }}>{row.killSwitch}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
