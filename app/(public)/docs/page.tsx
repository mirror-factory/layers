import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";

/**
 * Public docs index — Paper Calm card grid.
 *
 * Mirrors the typography + spacing rhythm of `/pricing` (clamp display sizes,
 * mint accent for emphasis, soft borders, OKLCH-only via tokens). The grid
 * itself is a plain CSS-grid card list — no accordion, no search, no nav tree.
 * Adding more docs is appending an entry to `CARDS`.
 */

export const metadata: Metadata = {
  title: "Docs · Layers",
  description:
    "Public docs for the Layers MCP server, REST API, error codes, and developer references.",
};

type Card = {
  title: string;
  href: string;
  external?: boolean;
  blurb: string;
  kicker: string;
  accent: "mint" | "violet" | "blue";
};

const CARDS: Card[] = [
  {
    kicker: "01 · Connectors",
    title: "MCP Quickstart",
    blurb:
      "Connect Claude Desktop, Cursor, Continue, or ChatGPT Desktop to your Layers meeting memory. OAuth dance, the eight tools, and example I/O.",
    href: "/docs/mcp",
    accent: "mint",
  },
  {
    kicker: "02 · HTTP",
    title: "REST API",
    blurb:
      "Read meetings, fetch transcripts, search your library. Same OAuth bearer that powers the MCP server.",
    href: "/docs/api",
    accent: "blue",
  },
  {
    kicker: "03 · Reference",
    title: "Error codes",
    blurb:
      "Stable error codes returned across MCP and REST surfaces. HTTP status, retry guidance, and what to do.",
    href: "/docs/errors",
    accent: "violet",
  },
  {
    kicker: "04 · Internal",
    title: "Code signing",
    blurb:
      "How macOS DMGs and Windows EXEs get signed. Reference doc for the team — `docs/SIGNING.md` in the repo.",
    href: "https://github.com/mirror-factory/audio-layer/blob/main/docs/SIGNING.md",
    external: true,
    accent: "violet",
  },
  {
    kicker: "05 · Internal",
    title: "Spend caps",
    blurb:
      "Per-user model spend caps and how they're enforced. Reference doc — `docs/SPEND_CAPS.md` in the repo.",
    href: "https://github.com/mirror-factory/audio-layer/blob/main/docs/SPEND_CAPS.md",
    external: true,
    accent: "violet",
  },
  {
    kicker: "06 · Internal",
    title: "Release flow",
    blurb:
      "Promotion order from feature → development → staging → main, plus env pinning and the artifact-URL pattern.",
    href: "https://github.com/mirror-factory/audio-layer/blob/main/docs/RELEASE.md",
    external: true,
    accent: "violet",
  },
];

const ACCENT: Record<Card["accent"], { tint: string; ink: string }> = {
  mint: { tint: "var(--layers-mint-tint)", ink: "var(--tier-mint-text)" },
  violet: { tint: "var(--layers-violet-tint)", ink: "var(--tier-violet-text)" },
  blue: { tint: "var(--layers-blue-tint)", ink: "var(--tier-blue-text)" },
};

export default function DocsIndexPage() {
  return (
    <div
      className="min-h-screen-safe"
      style={{
        ["--section-y" as string]: "clamp(56px, 7vw, 112px)",
        paddingBottom: "var(--section-y)",
      }}
    >
      <section
        aria-labelledby="docs-title"
        style={{
          width: "min(100% - 40px, 1180px)",
          margin: "0 auto",
          paddingTop: "var(--section-y)",
          paddingBottom: "clamp(32px, 4vw, 56px)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "6px 12px",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border-subtle)",
            background:
              "color-mix(in oklch, var(--bg-surface) 86%, transparent)",
            color: "var(--fg-muted)",
            fontSize: "var(--text-xs)",
            letterSpacing: "var(--tracking-uppercase)",
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "var(--radius-pill)",
              background: "var(--layers-mint)",
            }}
          />
          Developer docs
        </span>
        <h1
          id="docs-title"
          style={{
            marginTop: "var(--space-5)",
            color: "var(--layers-ink)",
            fontWeight: 600,
            fontSize: "clamp(2.4rem, 4.6vw, 3.8rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.022em",
            maxWidth: "20ch",
          }}
        >
          Plug Layers into the{" "}
          <em
            style={{
              fontStyle: "italic",
              fontWeight: 500,
              color: "var(--layers-mint)",
            }}
          >
            tools you already use.
          </em>
        </h1>
        <p
          style={{
            marginTop: "var(--space-5)",
            color: "var(--fg-muted)",
            fontSize: "clamp(1rem, 1.1vw, 1.125rem)",
            lineHeight: 1.6,
            maxWidth: "58ch",
          }}
        >
          Every Layers account ships with a Model Context Protocol server and a
          read-mostly REST surface. Same OAuth, same data. Pick a doorway.
        </p>
      </section>

      <section
        aria-label="Doc index"
        style={{
          width: "min(100% - 40px, 1180px)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "clamp(16px, 1.6vw, 28px)",
        }}
      >
        {CARDS.map((card) => (
          <DocCard key={card.title} card={card} />
        ))}
      </section>
    </div>
  );
}

function DocCard({ card }: { card: Card }) {
  const accent = ACCENT[card.accent];
  const inner = (
    <article
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "clamp(22px, 2.4vw, 32px)",
        borderRadius: "var(--radius-2xl)",
        background: `radial-gradient(circle at 100% 0%, color-mix(in oklch, ${accent.tint} 55%, transparent), transparent 60%), var(--bg-surface)`,
        border: "1px solid var(--border-default)",
        boxShadow:
          "0 1px 0 color-mix(in oklch, var(--bg-surface) 80%, white), 0 14px 38px oklch(0.22 0.035 256 / 0.05)",
        height: "100%",
      }}
    >
      <span
        style={{
          fontSize: "0.6875rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: accent.ink,
          fontWeight: 600,
        }}
      >
        {card.kicker}
      </span>
      <h2
        style={{
          fontSize: "var(--text-lg)",
          fontWeight: 600,
          color: "var(--layers-ink)",
          letterSpacing: "-0.01em",
          margin: 0,
          lineHeight: 1.25,
        }}
      >
        {card.title}
      </h2>
      <p
        style={{
          color: "var(--fg-muted)",
          fontSize: "var(--text-sm)",
          lineHeight: 1.6,
          margin: 0,
          maxWidth: "44ch",
        }}
      >
        {card.blurb}
      </p>
      <span
        style={{
          marginTop: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--layers-ink)",
        }}
      >
        {card.external ? "Read on GitHub" : "Open"}
        <ArrowUpRight size={14} aria-hidden />
      </span>
    </article>
  );

  if (card.external) {
    return (
      <a
        href={card.href}
        target="_blank"
        rel="noreferrer"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={card.href} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  );
}
