'use client';

/**
 * /dev-kit/coverage -- tool coverage matrix across tests, evals, and prod checks.
 */
import { useEffect, useMemo, useState } from 'react';

interface ToolCoverage {
  id: string;
  name: string;
  category: string;
  hasUnitTests: boolean;
  hasEvalCases: boolean;
  testedInProduction: boolean;
  testStatus: string;
  lastEvalScore: number | null;
}

function statusClass(status: string): string {
  switch (status) {
    case 'passing':
      return 'border-layers-mint/25 text-layers-mint';
    case 'failing':
      return 'border-signal-live/30 text-signal-live';
    default:
      return 'border-white/10 text-ink-200/45';
  }
}

function mark(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export default function CoveragePage() {
  const [coverage, setCoverage] = useState<ToolCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetch('/api/dev-kit/coverage', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.message ?? body?.error ?? `coverage failed (${response.status})`);
        }
        return Array.isArray(body) ? body : body.coverage ?? [];
      })
      .then((rows: ToolCoverage[]) => {
        if (!alive) return;
        setCoverage(rows);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => {
    const total = coverage.length;
    const unit = coverage.filter((tool) => tool.hasUnitTests).length;
    const evals = coverage.filter((tool) => tool.hasEvalCases).length;
    const production = coverage.filter((tool) => tool.testedInProduction).length;
    const passing = coverage.filter((tool) => tool.testStatus === 'passing').length;

    return { total, unit, evals, production, passing };
  }, [coverage]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-200/40">
        Loading coverage...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Coverage</h1>
        <p className="mt-1 text-sm text-ink-200/50">
          Tool coverage across unit tests, eval cases, and production regression checks.
        </p>
      </header>

      {error ? (
        <div className="rounded border border-signal-live/30 bg-signal-live/5 p-4 text-sm text-signal-live">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Tools" value={summary.total} />
        <Metric label="Passing" value={summary.passing} />
        <Metric label="Unit tests" value={`${summary.unit}/${summary.total}`} />
        <Metric label="Eval cases" value={`${summary.evals}/${summary.total}`} />
        <Metric label="Prod checks" value={`${summary.production}/${summary.total}`} />
      </section>

      {coverage.length === 0 ? (
        <div
          className="rounded border border-layers-mint/20 p-6 text-center"
          style={{ background: 'color-mix(in oklch, var(--layers-mint) 5%, transparent)' }}
        >
          <p className="text-sm text-ink-200/60">
            No coverage rows yet. Register tools and run test/eval capture to populate this matrix.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-ink-200/45">
              <tr>
                <th className="px-4 py-3 font-medium">Tool</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Eval</th>
                <th className="px-4 py-3 font-medium">Prod</th>
                <th className="px-4 py-3 font-medium">Last score</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((tool) => (
                <tr key={tool.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-medium text-ink-200">{tool.name}</td>
                  <td className="px-4 py-3 text-ink-200/55">{tool.category}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-1 text-xs ${statusClass(tool.testStatus)}`}>
                      {tool.testStatus || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-200/70">{mark(tool.hasUnitTests)}</td>
                  <td className="px-4 py-3 text-ink-200/70">{mark(tool.hasEvalCases)}</td>
                  <td className="px-4 py-3 text-ink-200/70">{mark(tool.testedInProduction)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-200/50">
                    {tool.lastEvalScore === null ? 'n/a' : tool.lastEvalScore.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-ink-200/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink-200">{value}</p>
    </div>
  );
}
