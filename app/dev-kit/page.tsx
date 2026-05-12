/**
 * Overview Page  --  /dev-kit
 * ===========================
 * The landing page for the AI Dev Kit dashboard. Displays high-level KPI
 * cards, proof gating status, and a system health summary with clearer
 * information hierarchy and denser at-a-glance context.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Library, Shield, Sparkles, Wrench } from "lucide-react";

import { navItems } from "./nav";
import { RealtimeIndicator, useRealtimeData } from "./use-realtime";

interface KPI {
  label: string;
  value: string;
  trend: number;
}

interface ModuleStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
}

interface OverviewData {
  kpis: KPI[];
  modules: ModuleStatus[];
}

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

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const realtime = useRealtimeData();

  useEffect(() => {
    if (realtime.eventCount > 0) {
      fetch("/api/dev-kit/overview")
        .then((response) => response.json())
        .then((next) => setData(next))
        .catch(() => {});
    }
  }, [realtime.eventCount]);

  useEffect(() => {
    fetch("/api/dev-kit/overview")
      .then((response) => response.json())
      .then((next) => {
        setData(next);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-ink-200/45 shadow-[0_1px_0_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.2)]">
        Loading overview...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-layers-mint/20 bg-layers-mint/5 px-6 py-8 shadow-[0_1px_0_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-layers-mint">
          <Sparkles size={12} />
          Overview
        </div>
        <h2 className="mt-3 text-xl font-semibold text-ink-200">No data yet</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-200/60">
          AI call traces will appear here once the app makes generateText or
          streamText calls with TelemetryIntegration wired.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {navItems.slice(0, 3).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <span className="rounded-xl border border-white/10 bg-black/10 p-2 text-layers-mint">
                  <Icon size={15} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-ink-200">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-ink-200/45">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-6 py-6 shadow-[0_1px_0_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.24)]">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-200/45">
            <span>Overview</span>
            <span className="text-ink-200/20">/</span>
            <span>Live metrics</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-layers-mint/30 bg-layers-mint/10 px-2 py-0.5 text-layers-mint">
              <Activity size={11} />
              realtime
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-ink-200">
                Command overview
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-200/55">
                Live metrics, proof pressure, and system health. This surface is
                intentionally sparse so the important signals read first.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <RealtimeIndicator connected={realtime.connected} />
              <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-200/45">
                forced gates active
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[
            {
              label: "Proof",
              value: "Registry-backed",
              text: "feature scope, required lanes, and evidence are enforced.",
            },
            {
              label: "Runtime",
              value: "Stable",
              text: "dashboard and API surfaces are reachable.",
            },
            {
              label: "Registry",
              value: "Live",
              text: "tools, vendors, and design tokens are read from the kit.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4"
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-200/35">
                {item.label}
              </div>
              <div className="mt-2 text-lg font-semibold text-ink-200">
                {item.value}
              </div>
              <p className="mt-1 text-xs leading-5 text-ink-200/45">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {data.kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.03)]"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-ink-200/45">
              {kpi.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-200">
              {kpi.value}
            </p>
            <p className={`mt-1 text-xs font-mono ${trendColor(kpi.trend)}`}>
              {trendIndicator(kpi.trend)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink-200">
                Gate sequence
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-200/50">
                What the harness expects before a change can be considered done.
              </p>
            </div>
            <span className="rounded-full border border-layers-mint/20 bg-layers-mint/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-layers-mint">
              enforced
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Feature registry match",
                text: "The change is matched against declared proof rules.",
              },
              {
                title: "Forced test lanes",
                text: "Relevant fast, expect, and browser lanes are required.",
              },
              {
                title: "Artifact capture",
                text: "Screenshots, videos, and packet evidence are recorded.",
              },
              {
                title: "Done proof",
                text: "The gate only flips green when mapped lanes are complete.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-white/10 bg-black/10 px-4 py-4"
              >
                <div className="text-sm font-medium text-ink-200">
                  {item.title}
                </div>
                <p className="mt-2 text-xs leading-5 text-ink-200/45">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink-200">
                System health
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-200/50">
                Current module state with a quieter visual rhythm.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-200/45">
              <Shield size={11} />
              healthy surfaces
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.modules.map((mod) => (
              <div
                key={mod.name}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/10 px-4 py-3"
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${statusDot(mod.status)}`}
                />
                <div>
                  <p className="text-sm font-medium text-ink-200">
                    {mod.name}
                  </p>
                  <p className="text-xs text-ink-200/50">
                    {statusLabel(mod.status)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          {
            title: "Proof surfaces",
            icon: Library,
            items: ["Proof packet", "Registries", "Expected lanes", "Artifact capture"],
          },
          {
            title: "Operational surfaces",
            icon: Wrench,
            items: ["Runs", "Status", "Coverage", "Sessions"],
          },
          {
            title: "Navigation",
            icon: ArrowUpRight,
            items: ["Project", "Project map", "Design system", "Deployments"],
          },
        ].map((group) => {
          const Icon = group.icon;
          return (
            <div
              key={group.title}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-xl border border-white/10 bg-black/10 p-2 text-layers-mint">
                  <Icon size={15} />
                </span>
                <h3 className="text-base font-semibold text-ink-200">
                  {group.title}
                </h3>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-ink-200/55"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
