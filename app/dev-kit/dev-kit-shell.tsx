"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, CircleDot, Sparkles } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { navGroups, navItems, resolveNavItem } from "./nav";

const devKitThemeVars = {
  "--ink-200": "var(--text-primary)",
} as CSSProperties;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition",
        active
          ? "border-layers-mint/40 bg-layers-mint/12 text-layers-mint"
          : "border-white/10 bg-white/[0.03] text-ink-200/70 hover:border-white/20 hover:bg-white/[0.05] hover:text-ink-200",
      ].join(" ")}
    >
      <span className="truncate">{label}</span>
      {active ? <CircleDot size={12} /> : null}
    </Link>
  );
}

export default function DevKitShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = resolveNavItem(pathname);

  return (
    <div
      className="min-h-screen overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)]"
      style={devKitThemeVars}
    >
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="hidden w-[20rem] shrink-0 border-r border-[var(--border-card)] bg-[var(--bg-surface)] lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-6 py-6">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-layers-mint">
              <Sparkles size={12} />
              AI Dev Kit
            </div>
            <div className="mt-2 text-xl font-semibold text-ink-200">
              Layers command surface
            </div>
            <p className="mt-2 max-w-[16rem] text-sm leading-6 text-ink-200/55">
              Registry-backed, proof-forced, and organized by task surface rather
              than a generic box grid.
            </p>
          </div>

          <div className="border-b border-white/10 px-6 py-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-ink-200/45">
                <span>Current surface</span>
                <span className="inline-flex items-center gap-1 text-layers-mint">
                  <CircleDot size={11} />
                  Live
                </span>
              </div>
              <div className="mt-3 text-base font-semibold text-ink-200">
                {current.label}
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-200/55">
                {current.description}
              </p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5">
            {navGroups.map((group) => (
              <section key={group.title} className="mb-6">
                <div className="mb-3 flex items-start justify-between gap-3 px-2">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-200/45">
                      {group.title}
                    </h2>
                    <p className="mt-1 max-w-[14rem] text-[11px] leading-5 text-ink-200/35">
                      {group.description}
                    </p>
                  </div>
                  <ChevronRight size={14} className="mt-0.5 text-ink-200/25" />
                </div>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          "group flex items-start gap-3 rounded-lg border px-3 py-3 transition",
                          active
                            ? "border-layers-mint/30 bg-layers-mint/10 text-ink-200 shadow-[0_0_0_1px_rgba(58,208,180,0.08)]"
                            : "border-white/5 bg-white/[0.02] text-ink-200/70 hover:border-white/12 hover:bg-white/[0.04] hover:text-ink-200",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mt-0.5 rounded-xl border p-2",
                            active
                              ? "border-layers-mint/30 bg-layers-mint/12 text-layers-mint"
                              : "border-white/10 bg-white/[0.03] text-ink-200/60 group-hover:text-ink-200",
                          ].join(" ")}
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">
                              {item.label}
                            </span>
                            {active ? (
                              <span className="rounded-full border border-layers-mint/30 bg-layers-mint/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-layers-mint">
                                active
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-ink-200/45">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="border-t border-white/10 px-6 py-4 text-[11px] text-ink-200/35">
            <div className="flex items-center justify-between gap-3">
              <span>@mirror-factory/ai-dev-kit</span>
              <span>{navItems.length} surfaces</span>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[var(--border-card)] bg-[var(--bg-page)] backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-layers-mint">
                  AI Dev Kit
                </div>
                <div className="mt-1 text-sm font-semibold text-ink-200">
                  {current.label}
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-layers-mint/30 bg-layers-mint/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-layers-mint">
                <CircleDot size={10} />
                Live
              </span>
            </div>

            <div className="overflow-x-auto px-3 pb-3">
              <div className="flex min-w-max gap-2">
                {navItems.map((item) => (
                  <NavPill
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isActive(pathname, item.href)}
                  />
                ))}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
              <section className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.28)]">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-200/45">
                  <span>Layers</span>
                  <span className="text-ink-200/20">/</span>
                  <span>AI Dev Kit</span>
                  <span className="rounded-full border border-layers-mint/25 bg-layers-mint/10 px-2 py-0.5 text-layers-mint">
                    proof-backed
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-ink-200/55">
                    {current.label}
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-ink-200 sm:text-[2rem]">
                      {current.label}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-200/55">
                      {current.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-200/35">
                        Surface
                      </div>
                      <div className="mt-1 text-sm font-semibold text-ink-200">
                        {current.label}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-200/35">
                        Proof
                      </div>
                      <div className="mt-1 text-sm font-semibold text-layers-mint">
                        forced
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-200/35">
                        Registry
                      </div>
                      <div className="mt-1 text-sm font-semibold text-ink-200">
                        live
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
