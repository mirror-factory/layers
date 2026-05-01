/**
 * Overview Page  --  /dev-kit
 * ===========================
 * The landing page for the AI Dev Kit dashboard. Displays high-level KPI
 * cards (Total Cost, Avg Latency, Eval Pass Rate, Active Tools, System
 * Health) with trend indicators, plus a system health summary showing the
 * status of every module.
 *
 * Fetches live data from /api/dev-kit/overview; shows empty state when unavailable.
 */

"use client";

import { useEffect, useState } from "react";
import { useRealtimeData, RealtimeIndicator } from "./use-realtime";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KPI {
  label: string;
  value: string;
  trend: number; // positive = up, negative = down (percentage vs prior period)
}

interface ModuleStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
}

interface OverviewData {
  kpis: KPI[];
  modules: ModuleStatus[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trendIndicator(trend: number): string {
  if (trend > 0) return `[+${trend}%]`;
  if (trend < 0) return `[${trend}%]`;
  return "--";
}

function trendColor(trend: number): string {
  if (trend > 0) return "text-layers-mint";
  if (trend < 0) return "text-signal-live";
  return "text-ink-200/40";
}

function statusDot(status: ModuleStatus["status"]): string {
  switch (status) {
    case "healthy":
      return "bg-layers-mint";
    case "degraded":
      return "bg-yellow-400";
    case "down":
      return "bg-signal-live";
  }
}

function statusLabel(status: ModuleStatus["status"]): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const realtime = useRealtimeData();

  // Re-fetch when realtime events arrive
  useEffect(() => {
    if (realtime.eventCount > 0) {
      fetch('/api/dev-kit/overview')
        .then(r => r.json())
        .then(d => setData(d))
        .catch(() => {});
    }
  }, [realtime.eventCount]);

  useEffect(() => {
    fetch('/api/dev-kit/overview')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-200/40">
        Loading overview...
      </div>
    );
  }

  if (!data) return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Overview</h1>
      <div className="border border-layers-mint/20 rounded p-6 text-center" style={{ background: "color-mix(in oklch, var(--layers-mint) 5%, transparent)" }}>
        <p className="text-ink-200/60 text-sm">No data yet. AI call traces will appear here as your application makes generateText/streamText calls with TelemetryIntegration wired.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Overview</h1>
          <RealtimeIndicator connected={realtime.connected} />
        </div>
        <p className="mt-1 text-sm text-ink-200/50">
          High-level metrics and system health at a glance.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {data.kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-4"
          >
            <p className="text-xs uppercase tracking-wider text-ink-200/50">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{kpi.value}</p>
            <p className={`mt-1 text-xs font-mono ${trendColor(kpi.trend)}`}>
              {trendIndicator(kpi.trend)}
            </p>
          </div>
        ))}
      </div>

      {/* System health summary */}
      <div>
        <h2 className="text-lg font-medium mb-4">System Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.modules.map((mod) => (
            <div
              key={mod.name}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${statusDot(mod.status)}`}
              />
              <div>
                <p className="text-sm font-medium">{mod.name}</p>
                <p className="text-xs text-ink-200/50">
                  {statusLabel(mod.status)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
