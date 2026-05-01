/**
 * AI Observability Dashboard — Full production visibility
 *
 * 5 tabs:
 *   1. AI Calls — log table with filters, drill-down detail panel
 *   2. Errors — error log with source, stack, tool/model context
 *   3. Sessions — per-chat timeline (cost, tools, errors per conversation)
 *   4. Charts — cost/day, TTFT histogram, model distribution, tool frequency
 *   5. HTTP — all API request logs (path, status, latency)
 *
 * Data: Fetches from /api/ai-logs, /api/ai-logs/stats, /api/ai-logs/errors
 * Refresh: Auto-refresh every 5s (toggleable)
 * Persistence: Backend-dependent (supabase, file, or memory)
 *
 * Usage:
 *   Copy to app/observability/page.tsx
 *   Wire api routes from templates/api-ai-logs-*.ts
 *   Add auth middleware for production
 *
 * Zero external dependencies (no Chart.js needed — uses CSS bar charts)
 *
 * LIMITATIONS (honest):
 *   - No prompt/response content (add via expandable detail if needed)
 *   - No alerting/thresholds (use Langfuse or Sentry for that)
 *   - CSS-only charts (no interactive zoom/pan — upgrade to recharts if needed)
 *   - For full production observability, wire Langfuse (see guides/OBSERVABILITY.md)
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

// ── Shared Types ──────────────────────────────────────────────────────

interface AILogRecord {
  id: string; timestamp: string; userId: string; sessionId: string;
  chatId: string; label: string; provider: string; modelId: string;
  inputTokens: number; outputTokens: number; totalTokens: number;
  cost: number; durationMs: number; ttftMs: number | null; steps: number;
  toolCalls: string[]; cacheReadTokens: number; cacheWriteTokens: number;
  error: string | null; finishReason: string | null;
  tokensPerSecond: number | null; aborted: boolean;
}

interface ErrorRecord {
  id: string; timestamp: string; userId: string; chatId: string;
  label: string; source: string; message: string; stack: string | null;
  modelId: string | null; toolName: string | null;
  metadata: Record<string, string>;
}

interface SessionSummary {
  chatId: string; userId: string; firstSeen: string; lastSeen: string;
  calls: number; cost: number; tokens: number; tools: string[]; errors: number;
}

interface Stats {
  totalCalls: number; totalCost: number; totalTokens: number;
  avgTTFT: number; p95TTFT: number; errorRate: number; abortRate: number;
  totalErrors: number;
  modelBreakdown: Record<string, { calls: number; cost: number; tokens: number; avgTTFT: number }>;
  costByDay: Record<string, number>;
  callsByDay: Record<string, number>;
  errorsByDay: Record<string, number>;
  toolFrequency: Record<string, number>;
  sessions: SessionSummary[];
  backend: string;
}

// ── Formatters ────────────────────────────────────────────────────────

const fmt = {
  cost: (c: number) => c === 0 ? '$0.00' : c < 0.01 ? `$${c.toFixed(4)}` : `$${c.toFixed(2)}`,
  dur: (ms: number) => ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`,
  tok: (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n),
  ago: (ts: string) => {
    const d = Date.now() - new Date(ts).getTime();
    if (d < 6e4) return 'just now';
    if (d < 36e5) return `${Math.floor(d / 6e4)}m ago`;
    if (d < 864e5) return `${Math.floor(d / 36e5)}h ago`;
    return `${Math.floor(d / 864e5)}d ago`;
  },
  pct: (n: number) => `${n.toFixed(1)}%`,
};

const OBS_COLORS = {
  canvas: 'var(--layers-ink)',
  surface: 'color-mix(in oklch, var(--layers-ink) 91%, var(--layers-mint) 9%)',
  surfaceRaised: 'color-mix(in oklch, var(--layers-ink) 84%, var(--layers-mint) 16%)',
  border: 'color-mix(in oklch, var(--layers-mint) 22%, transparent)',
  mint: 'var(--layers-mint-soft)',
  warning: 'var(--signal-warning)',
  live: 'var(--signal-live)',
  success: 'var(--signal-success)',
  blue: 'var(--layers-blue-soft)',
  violet: 'var(--layers-violet-soft)',
  text: 'var(--ink-200)',
  muted: 'var(--ink-400)',
  faint: 'var(--ink-600)',
} as const;

const tint = (color: string, amount = 18) =>
  `color-mix(in oklch, ${color} ${amount}%, transparent)`;

// ── Styles (inline object, no external CSS) ───────────────────────────

const S = {
  root: { minHeight: '100vh', maxWidth: '100vw', overflowX: 'hidden' as const, background: OBS_COLORS.canvas, color: OBS_COLORS.text, fontFamily: "'SF Mono', 'Fira Code', ui-monospace, monospace", fontSize: 13 } as const,
  header: { padding: '12px clamp(12px, 4vw, 24px)', borderBottom: `1px solid ${OBS_COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 } as const,
  tabs: { display: 'flex', gap: 0, borderBottom: `1px solid ${OBS_COLORS.border}`, overflowX: 'auto' as const, maxWidth: '100vw' } as const,
  tab: (active: boolean) => ({ padding: '10px 20px', cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: active ? OBS_COLORS.surface : 'transparent', color: active ? OBS_COLORS.mint : OBS_COLORS.muted, borderBottom: active ? `2px solid ${OBS_COLORS.mint}` : '2px solid transparent' }),
  card: { background: OBS_COLORS.surface, border: `1px solid ${OBS_COLORS.border}`, borderRadius: 8, padding: '12px 16px' } as const,
  statVal: (color: string) => ({ fontSize: 20, fontWeight: 700, color, marginTop: 4 }),
  statLabel: { fontSize: 10, color: OBS_COLORS.muted, textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as const,
  badge: (color: string) => ({ background: tint(color), color, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600 }),
  errorRow: { boxShadow: `inset 0 0 0 1px ${OBS_COLORS.live}` } as const,
  tableHead: { fontSize: 10, color: OBS_COLORS.muted, textTransform: 'uppercase' as const, fontWeight: 600, padding: '8px 12px', textAlign: 'left' as const } as const,
  td: { padding: '6px 12px' } as const,
  barBg: { background: OBS_COLORS.surfaceRaised, borderRadius: 4, height: 20, position: 'relative' as const, overflow: 'hidden' as const },
  barFill: (pct: number, color: string) => ({ position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }),
};

// ── Component ─────────────────────────────────────────────────────────

type Tab = 'calls' | 'errors' | 'sessions' | 'charts' | 'http';

export default function AIObservabilityPage() {
  const [tab, setTab] = useState<Tab>('calls');
  const [logs, setLogs] = useState<AILogRecord[]>([]);
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AILogRecord | null>(null);
  const [selectedError, setSelectedError] = useState<ErrorRecord | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filters, setFilters] = useState({ userId: '', chatId: '', model: '', label: '' });

  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.chatId) params.set('chatId', filters.chatId);
      if (filters.label) params.set('label', filters.label);
      params.set('limit', '200');

      const [logsR, statsR, errorsR] = await Promise.all([
        fetch(`/api/ai-logs?${params}`),
        fetch(`/api/ai-logs/stats?${params}`),
        fetch(`/api/ai-logs/errors?${params}`),
      ]);
      if (logsR.ok) setLogs(await logsR.json());
      if (statsR.ok) setStats(await statsR.json());
      if (errorsR.ok) setErrors(await errorsR.json());
    } catch { /* best-effort */ } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchAll]);

  const filtered = useMemo(() =>
    filters.model ? logs.filter(l => l.modelId.includes(filters.model)) : logs
  , [logs, filters.model]);

  const uniqueModels = useMemo(() => [...new Set(logs.map(l => l.modelId))], [logs]);
  const uniqueUsers = useMemo(() => [...new Set(logs.map(l => l.userId))], [logs]);
  const uniqueLabels = useMemo(() => [...new Set(logs.map(l => l.label))], [logs]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div style={S.root}>
      {/* Header */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: OBS_COLORS.mint }} />
          <h1 style={{ fontSize: 16, fontWeight: 700, color: OBS_COLORS.mint }}>AI Observability</h1>
          {stats && <span style={{ fontSize: 10, color: OBS_COLORS.faint, marginLeft: 8 }}>
            backend: {stats.backend}
          </span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: OBS_COLORS.muted, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ accentColor: OBS_COLORS.mint }} />
            Auto-refresh
          </label>
          <button onClick={fetchAll} style={{ background: OBS_COLORS.surfaceRaised, border: `1px solid ${OBS_COLORS.border}`, borderRadius: 6, color: OBS_COLORS.text, padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}>
            Refresh
          </button>
        </div>
      </header>

      {/* Stats Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: 10, padding: '12px clamp(12px, 4vw, 24px)' }}>
          {[
            { l: 'Calls', v: stats.totalCalls.toLocaleString(), c: OBS_COLORS.mint },
            { l: 'Cost', v: fmt.cost(stats.totalCost), c: OBS_COLORS.warning },
            { l: 'Tokens', v: fmt.tok(stats.totalTokens), c: OBS_COLORS.blue },
            { l: 'Avg TTFT', v: stats.avgTTFT > 0 ? fmt.dur(stats.avgTTFT) : 'N/A', c: OBS_COLORS.blue },
            { l: 'P95 TTFT', v: stats.p95TTFT > 0 ? fmt.dur(stats.p95TTFT) : 'N/A', c: OBS_COLORS.blue },
            { l: 'Error Rate', v: fmt.pct(stats.errorRate), c: stats.errorRate > 5 ? OBS_COLORS.live : OBS_COLORS.success },
            { l: 'Errors', v: stats.totalErrors.toString(), c: stats.totalErrors > 0 ? OBS_COLORS.live : OBS_COLORS.success },
            { l: 'Models', v: Object.keys(stats.modelBreakdown).length.toString(), c: OBS_COLORS.violet },
          ].map(({ l, v, c }) => (
            <div key={l} style={S.card}>
              <div style={S.statLabel}>{l}</div>
              <div style={S.statVal(c)}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabs}>
        {(['calls', 'errors', 'sessions', 'charts', 'http'] as Tab[]).map(t => (
          <div key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {t}{t === 'errors' && stats && stats.totalErrors > 0 ? ` (${stats.totalErrors})` : ''}
          </div>
        ))}
      </div>

      {/* Filters (shown on calls + errors tabs) */}
      {(tab === 'calls' || tab === 'errors') && (
        <div style={{ padding: '8px clamp(12px, 4vw, 24px)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderBottom: `1px solid ${OBS_COLORS.border}` }}>
          <span style={{ fontSize: 10, color: OBS_COLORS.faint }}>FILTER:</span>
          {uniqueUsers.length > 1 && (
            <select value={filters.userId} onChange={e => setFilters(f => ({ ...f, userId: e.target.value }))} style={{ background: OBS_COLORS.surface, border: `1px solid ${OBS_COLORS.border}`, borderRadius: 4, color: OBS_COLORS.text, padding: '3px 6px', fontSize: 11 }}>
              <option value="">All users</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
          {uniqueLabels.length > 1 && (
            <select value={filters.label} onChange={e => setFilters(f => ({ ...f, label: e.target.value }))} style={{ background: OBS_COLORS.surface, border: `1px solid ${OBS_COLORS.border}`, borderRadius: 4, color: OBS_COLORS.text, padding: '3px 6px', fontSize: 11 }}>
              <option value="">All labels</option>
              {uniqueLabels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {uniqueModels.length > 1 && (
            <select value={filters.model} onChange={e => setFilters(f => ({ ...f, model: e.target.value }))} style={{ background: OBS_COLORS.surface, border: `1px solid ${OBS_COLORS.border}`, borderRadius: 4, color: OBS_COLORS.text, padding: '3px 6px', fontSize: 11 }}>
              <option value="">All models</option>
              {uniqueModels.map(m => <option key={m} value={m}>{m.split('/').pop()}</option>)}
            </select>
          )}
          <input placeholder="Chat ID..." value={filters.chatId} onChange={e => setFilters(f => ({ ...f, chatId: e.target.value }))} style={{ background: OBS_COLORS.surface, border: `1px solid ${OBS_COLORS.border}`, borderRadius: 4, color: OBS_COLORS.text, padding: '3px 6px', fontSize: 11, width: 140 }} />
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ userId: '', chatId: '', model: '', label: '' })} style={{ background: 'none', border: `1px solid ${OBS_COLORS.border}`, borderRadius: 4, color: OBS_COLORS.muted, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>Clear</button>
          )}
        </div>
      )}

      {/* Tab Content */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, width: '100%', maxWidth: '100vw' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: OBS_COLORS.faint }}>Loading...</div>}

        {/* ─── AI Calls Tab ──────────────────────────────────────── */}
        {!loading && tab === 'calls' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${OBS_COLORS.border}` }}>
              {['Time', 'User', 'Label', 'Model', 'Tokens', 'Cost', 'TTFT', 'Duration', 'Tools', 'Cache', 'Status'].map(h =>
                <th key={h} style={S.tableHead}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: OBS_COLORS.faint }}>No AI calls recorded yet.</td></tr>}
              {filtered.map(l => (
                <tr key={l.id} onClick={() => setSelected(selected?.id === l.id ? null : l)}
                  style={{ borderBottom: `1px solid ${OBS_COLORS.border}`, cursor: 'pointer', background: selected?.id === l.id ? OBS_COLORS.surfaceRaised : 'transparent', ...(l.error ? S.errorRow : {}) }}>
                  <td style={{ ...S.td, color: OBS_COLORS.muted, fontSize: 11 }}>{fmt.ago(l.timestamp)}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.muted }}>{l.userId === 'anonymous' ? '-' : l.userId.slice(0, 8)}</td>
                  <td style={S.td}><span style={S.badge(OBS_COLORS.mint)}>{l.label}</span></td>
                  <td style={{ ...S.td, color: OBS_COLORS.text }}>{l.modelId.split('/').pop()}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.muted }}>{fmt.tok(l.totalTokens)}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.warning, fontWeight: 600 }}>{fmt.cost(l.cost)}</td>
                  <td style={{ ...S.td, color: l.ttftMs && l.ttftMs > 3000 ? OBS_COLORS.live : OBS_COLORS.blue }}>{l.ttftMs ? fmt.dur(l.ttftMs) : '-'}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.muted }}>{fmt.dur(l.durationMs)}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.blue }}>{l.toolCalls.length > 0 ? `${l.toolCalls.length}` : '-'}</td>
                  <td style={S.td}>{l.cacheReadTokens > 0 ? <span style={{ color: OBS_COLORS.success, fontSize: 11 }}>{Math.round(l.cacheReadTokens / l.inputTokens * 100)}%</span> : '-'}</td>
                  <td style={S.td}>{l.error ? <span style={S.badge(OBS_COLORS.live)}>ERR</span> : l.aborted ? <span style={S.badge(OBS_COLORS.warning)}>ABORT</span> : <span style={{ color: OBS_COLORS.success, fontSize: 11 }}>OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ─── Errors Tab ────────────────────────────────────────── */}
        {!loading && tab === 'errors' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${OBS_COLORS.border}` }}>
              {['Time', 'Source', 'Message', 'User', 'Model', 'Tool'].map(h =>
                <th key={h} style={S.tableHead}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {errors.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: OBS_COLORS.faint }}>No errors recorded.</td></tr>}
              {errors.map(e => (
                <tr key={e.id} onClick={() => setSelectedError(selectedError?.id === e.id ? null : e)}
                  style={{ borderBottom: `1px solid ${OBS_COLORS.border}`, cursor: 'pointer', background: selectedError?.id === e.id ? OBS_COLORS.surfaceRaised : 'transparent', ...S.errorRow }}>
                  <td style={{ ...S.td, color: OBS_COLORS.muted, fontSize: 11 }}>{fmt.ago(e.timestamp)}</td>
                  <td style={S.td}><span style={S.badge(OBS_COLORS.live)}>{e.source}</span></td>
                  <td style={{ ...S.td, color: OBS_COLORS.text, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.message}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.muted }}>{e.userId === 'anonymous' ? '-' : e.userId.slice(0, 8)}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.muted }}>{e.modelId?.split('/').pop() ?? '-'}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.blue }}>{e.toolName ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ─── Sessions Tab ──────────────────────────────────────── */}
        {!loading && tab === 'sessions' && stats && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${OBS_COLORS.border}` }}>
              {['Chat ID', 'User', 'Started', 'Last Active', 'Calls', 'Tokens', 'Cost', 'Tools', 'Errors'].map(h =>
                <th key={h} style={S.tableHead}>{h}</th>
              )}
            </tr></thead>
            <tbody>
              {stats.sessions.length === 0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: OBS_COLORS.faint }}>No sessions recorded.</td></tr>}
              {stats.sessions.map(s => (
                <tr key={s.chatId} style={{ borderBottom: `1px solid ${OBS_COLORS.border}`, cursor: 'pointer', ...(s.errors > 0 ? S.errorRow : {}) }}
                  onClick={() => setFilters(f => ({ ...f, chatId: s.chatId }))}>
                  <td style={{ ...S.td, color: OBS_COLORS.mint, fontFamily: 'monospace', fontSize: 11 }}>{s.chatId.slice(0, 12)}...</td>
                  <td style={{ ...S.td, color: OBS_COLORS.muted }}>{s.userId === 'anonymous' ? '-' : s.userId.slice(0, 8)}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.muted, fontSize: 11 }}>{fmt.ago(s.firstSeen)}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.muted, fontSize: 11 }}>{fmt.ago(s.lastSeen)}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.text }}>{s.calls}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.muted }}>{fmt.tok(s.tokens)}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.warning, fontWeight: 600 }}>{fmt.cost(s.cost)}</td>
                  <td style={{ ...S.td, color: OBS_COLORS.blue }}>{s.tools.length > 0 ? s.tools.slice(0, 3).join(', ') + (s.tools.length > 3 ? ` +${s.tools.length - 3}` : '') : '-'}</td>
                  <td style={S.td}>{s.errors > 0 ? <span style={S.badge(OBS_COLORS.live)}>{s.errors}</span> : <span style={{ color: OBS_COLORS.success, fontSize: 11 }}>0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ─── Charts Tab (CSS bar charts — zero dependencies) ─── */}
        {!loading && tab === 'charts' && stats && (
          <div style={{ padding: 'clamp(12px, 4vw, 24px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 24 }}>
            {/* Cost by Day */}
            <div style={S.card}>
              <div style={{ ...S.statLabel, marginBottom: 12 }}>Cost / Day</div>
              {Object.entries(stats.costByDay).length === 0 && <div style={{ color: OBS_COLORS.faint, fontSize: 11 }}>No data yet</div>}
              {Object.entries(stats.costByDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([day, cost]) => {
                const maxCost = Math.max(...Object.values(stats.costByDay));
                const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 60, fontSize: 10, color: OBS_COLORS.muted, textAlign: 'right' }}>{day.slice(5)}</span>
                    <div style={{ ...S.barBg, flex: 1 }}>
                      <div style={S.barFill(pct, OBS_COLORS.warning)} />
                    </div>
                    <span style={{ width: 50, fontSize: 10, color: OBS_COLORS.warning, textAlign: 'right' }}>{fmt.cost(cost)}</span>
                  </div>
                );
              })}
            </div>

            {/* Calls by Day */}
            <div style={S.card}>
              <div style={{ ...S.statLabel, marginBottom: 12 }}>Calls / Day</div>
              {Object.entries(stats.callsByDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([day, calls]) => {
                const maxCalls = Math.max(...Object.values(stats.callsByDay));
                const pct = maxCalls > 0 ? (calls / maxCalls) * 100 : 0;
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 60, fontSize: 10, color: OBS_COLORS.muted, textAlign: 'right' }}>{day.slice(5)}</span>
                    <div style={{ ...S.barBg, flex: 1 }}>
                      <div style={S.barFill(pct, OBS_COLORS.mint)} />
                    </div>
                    <span style={{ width: 30, fontSize: 10, color: OBS_COLORS.mint, textAlign: 'right' }}>{calls}</span>
                  </div>
                );
              })}
            </div>

            {/* Model Breakdown */}
            <div style={S.card}>
              <div style={{ ...S.statLabel, marginBottom: 12 }}>Model Usage</div>
              {Object.entries(stats.modelBreakdown).sort(([, a], [, b]) => b.cost - a.cost).map(([model, d]) => {
                const totalCalls = stats.totalCalls || 1;
                const pct = (d.calls / totalCalls) * 100;
                return (
                  <div key={model} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: OBS_COLORS.text }}>{model.split('/').pop()}</span>
                      <span style={{ color: OBS_COLORS.muted }}>{d.calls} calls | {fmt.cost(d.cost)} | {fmt.dur(d.avgTTFT)} TTFT</span>
                    </div>
                    <div style={{ ...S.barBg, height: 12 }}>
                      <div style={S.barFill(pct, OBS_COLORS.blue)} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tool Frequency */}
            <div style={S.card}>
              <div style={{ ...S.statLabel, marginBottom: 12 }}>Tool Frequency</div>
              {Object.entries(stats.toolFrequency).length === 0 && <div style={{ color: OBS_COLORS.faint, fontSize: 11 }}>No tool calls yet</div>}
              {Object.entries(stats.toolFrequency).sort(([, a], [, b]) => b - a).slice(0, 15).map(([tool, count]) => {
                const maxCount = Math.max(...Object.values(stats.toolFrequency));
                const pct = (count / maxCount) * 100;
                return (
                  <div key={tool} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 120, fontSize: 10, color: OBS_COLORS.muted, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool}</span>
                    <div style={{ ...S.barBg, flex: 1, height: 14 }}>
                      <div style={S.barFill(pct, OBS_COLORS.violet)} />
                    </div>
                    <span style={{ width: 30, fontSize: 10, color: OBS_COLORS.violet, textAlign: 'right' }}>{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Errors by Day */}
            <div style={{ ...S.card, gridColumn: '1 / -1' }}>
              <div style={{ ...S.statLabel, marginBottom: 12 }}>Errors / Day</div>
              {Object.entries(stats.errorsByDay).length === 0 && <div style={{ color: OBS_COLORS.success, fontSize: 11 }}>No errors</div>}
              {Object.entries(stats.errorsByDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([day, count]) => {
                const maxErrors = Math.max(...Object.values(stats.errorsByDay), 1);
                const pct = (count / maxErrors) * 100;
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 60, fontSize: 10, color: OBS_COLORS.muted, textAlign: 'right' }}>{day.slice(5)}</span>
                    <div style={{ ...S.barBg, flex: 1, height: 14 }}>
                      <div style={S.barFill(pct, OBS_COLORS.live)} />
                    </div>
                    <span style={{ width: 20, fontSize: 10, color: OBS_COLORS.live, textAlign: 'right' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── HTTP Tab (placeholder — wire logHTTPRequest middleware) */}
        {!loading && tab === 'http' && (
          <div style={{ padding: 40, textAlign: 'center', color: OBS_COLORS.faint }}>
            <div style={{ fontSize: 14, marginBottom: 8, color: OBS_COLORS.muted }}>HTTP Request Logging</div>
            <div style={{ fontSize: 12, maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
              Wire the <code style={{ color: OBS_COLORS.mint }}>logHTTPRequest()</code> middleware in your <code style={{ color: OBS_COLORS.mint }}>middleware.ts</code> to see all API requests here.
              <br /><br />
              Tracks: method, path, status code, latency, user, user-agent.
              <br /><br />
              See <code style={{ color: OBS_COLORS.mint }}>templates/ai-telemetry-middleware.ts</code> for the <code style={{ color: OBS_COLORS.mint }}>logHTTPRequest()</code> function.
            </div>
          </div>
        )}
      </div>

      {/* ─── Detail Panel (AI call) ──────────────────────────────── */}
      {selected && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: OBS_COLORS.surface, borderTop: `2px solid ${OBS_COLORS.border}`, padding: 20, maxHeight: '40vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: OBS_COLORS.mint }}>{selected.label} — {selected.modelId}</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: OBS_COLORS.muted, cursor: 'pointer', fontSize: 14 }}>x</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {([
              ['ID', selected.id], ['Time', new Date(selected.timestamp).toLocaleString()],
              ['User', selected.userId], ['Session', selected.sessionId], ['Chat', selected.chatId],
              ['Provider', selected.provider], ['Model', selected.modelId],
              ['Input Tokens', selected.inputTokens.toLocaleString()], ['Output Tokens', selected.outputTokens.toLocaleString()],
              ['Cost', fmt.cost(selected.cost)], ['Duration', fmt.dur(selected.durationMs)],
              ['TTFT', selected.ttftMs ? fmt.dur(selected.ttftMs) : 'N/A'],
              ['Tokens/sec', selected.tokensPerSecond ? `${selected.tokensPerSecond.toFixed(1)}` : 'N/A'],
              ['Steps', String(selected.steps)], ['Finish', selected.finishReason ?? 'N/A'],
              ['Cache Read', selected.cacheReadTokens > 0 ? `${selected.cacheReadTokens.toLocaleString()} tokens` : 'None'],
              ['Cache Write', selected.cacheWriteTokens > 0 ? `${selected.cacheWriteTokens.toLocaleString()} tokens` : 'None'],
              ['Tools', selected.toolCalls.length > 0 ? selected.toolCalls.join(', ') : 'None'],
              ['Error', selected.error ?? 'None'], ['Aborted', selected.aborted ? 'Yes' : 'No'],
            ] as [string, string][]).map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 9, color: OBS_COLORS.faint, textTransform: 'uppercase' }}>{l}</div><div style={{ fontSize: 11, color: v === 'None' || v === 'N/A' ? OBS_COLORS.faint : OBS_COLORS.text, marginTop: 1, wordBreak: 'break-all' }}>{v}</div></div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Detail Panel (Error) ────────────────────────────────── */}
      {selectedError && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: tint(OBS_COLORS.live, 12), borderTop: `2px solid ${OBS_COLORS.live}`, padding: 20, maxHeight: '50vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: OBS_COLORS.live }}>Error — {selectedError.source}</span>
            <button onClick={() => setSelectedError(null)} style={{ background: 'none', border: 'none', color: OBS_COLORS.muted, cursor: 'pointer', fontSize: 14 }}>x</button>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: OBS_COLORS.faint, textTransform: 'uppercase' }}>Message</div>
            <div style={{ fontSize: 12, color: OBS_COLORS.live, marginTop: 2 }}>{selectedError.message}</div>
          </div>
          {selectedError.stack && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: OBS_COLORS.faint, textTransform: 'uppercase' }}>Stack Trace</div>
              <pre style={{ fontSize: 10, color: OBS_COLORS.muted, marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 200, overflow: 'auto', background: OBS_COLORS.canvas, padding: 8, borderRadius: 4 }}>{selectedError.stack}</pre>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {([
              ['Time', new Date(selectedError.timestamp).toLocaleString()],
              ['User', selectedError.userId], ['Chat', selectedError.chatId],
              ['Model', selectedError.modelId ?? 'N/A'], ['Tool', selectedError.toolName ?? 'N/A'],
              ['Label', selectedError.label],
            ] as [string, string][]).map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 9, color: OBS_COLORS.faint, textTransform: 'uppercase' }}>{l}</div><div style={{ fontSize: 11, color: OBS_COLORS.text, marginTop: 1 }}>{v}</div></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
