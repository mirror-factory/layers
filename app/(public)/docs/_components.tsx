/**
 * Shared building blocks for `/docs/*` pages.
 *
 * Tokens come from globals.css (Paper Calm). Keep these primitives small and
 * self-contained so each doc page reads top-to-bottom without prop drilling.
 *
 * Server components only — no `"use client"`. Underscore-prefixed folder
 * keeps Next.js from treating it as a route.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function DocShell({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: ReactNode;
  lede: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-screen-safe"
      style={{
        ["--section-y" as string]: "clamp(56px, 7vw, 112px)",
        ["--gutter" as string]: "clamp(20px, 4vw, 56px)",
        paddingBottom: "var(--section-y)",
      }}
    >
      <section
        aria-labelledby="doc-title"
        style={{
          width: "min(100% - 40px, 980px)",
          margin: "0 auto",
          paddingTop: "var(--section-y)",
          paddingBottom: "clamp(24px, 3vw, 48px)",
        }}
      >
        <Link
          href="/docs"
          style={{
            display: "inline-block",
            color: "var(--fg-muted)",
            fontSize: "var(--text-xs)",
            letterSpacing: "var(--tracking-uppercase)",
            textTransform: "uppercase",
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: "var(--space-5)",
          }}
        >
          ← Docs index
        </Link>
        <span
          style={{
            display: "block",
            color: "var(--brand-accent-muted)",
            fontSize: "var(--text-xs)",
            letterSpacing: "var(--tracking-uppercase)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {kicker}
        </span>
        <h1
          id="doc-title"
          style={{
            marginTop: "var(--space-3)",
            color: "var(--layers-ink)",
            fontWeight: 600,
            fontSize: "clamp(2.2rem, 4.4vw, 3.4rem)",
            lineHeight: 1.06,
            letterSpacing: "-0.022em",
            maxWidth: "22ch",
          }}
        >
          {title}
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
          {lede}
        </p>
      </section>
      <article
        style={{
          width: "min(100% - 40px, 820px)",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "clamp(40px, 4vw, 64px)",
        }}
      >
        {children}
      </article>
    </div>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
      <h2
        style={{
          color: "var(--layers-ink)",
          fontSize: "clamp(1.5rem, 2.6vw, 2rem)",
          fontWeight: 600,
          letterSpacing: "-0.018em",
          lineHeight: 1.15,
          margin: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        color: "var(--fg-default)",
        fontSize: "var(--text-md)",
        lineHeight: 1.65,
      }}
    >
      {children}
    </div>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 var(--space-4)",
        color: "var(--fg-default)",
        fontSize: "var(--text-md)",
        lineHeight: 1.65,
      }}
    >
      {children}
    </p>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.9em",
        padding: "1px 6px",
        borderRadius: "var(--radius-sm)",
        background: "color-mix(in oklch, var(--bg-page) 80%, transparent)",
        border: "1px solid var(--border-subtle)",
        color: "var(--layers-ink)",
      }}
    >
      {children}
    </code>
  );
}

export function CodeBlock({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-default)",
        background: "color-mix(in oklch, var(--bg-page) 60%, transparent)",
        overflow: "hidden",
      }}
    >
      {label ? (
        <div
          style={{
            padding: "var(--space-2) var(--space-4)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--fg-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            borderBottom: "1px solid var(--border-subtle)",
            background: "color-mix(in oklch, var(--bg-surface) 60%, transparent)",
          }}
        >
          {label}
        </div>
      ) : null}
      <pre
        style={{
          margin: 0,
          padding: "var(--space-4)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.85rem",
          lineHeight: 1.55,
          color: "var(--layers-ink)",
          overflowX: "auto",
        }}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title?: string;
  children: ReactNode;
}) {
  const palette =
    tone === "warn"
      ? {
          tint: "var(--layers-violet-tint)",
          ink: "var(--tier-violet-text)",
        }
      : {
          tint: "var(--layers-mint-tint)",
          ink: "var(--tier-mint-text)",
        };

  return (
    <div
      role="note"
      style={{
        padding: "var(--space-4) var(--space-5)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        background: `color-mix(in oklch, ${palette.tint} 55%, transparent)`,
        color: "var(--fg-default)",
        fontSize: "var(--text-sm)",
        lineHeight: 1.6,
      }}
    >
      {title ? (
        <strong
          style={{
            display: "block",
            color: palette.ink,
            fontSize: "var(--text-xs)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: "var(--space-2)",
          }}
        >
          {title}
        </strong>
      ) : null}
      {children}
    </div>
  );
}

export function StepList({ steps }: { steps: { title: string; body: ReactNode }[] }) {
  return (
    <ol
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        counterReset: "step",
      }}
    >
      {steps.map((step, i) => (
        <li
          key={step.title}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            columnGap: "var(--space-4)",
            alignItems: "baseline",
          }}
        >
          <span
            aria-hidden
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--fg-subtle)",
              fontWeight: 500,
              letterSpacing: "0.05em",
            }}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <h3
              style={{
                margin: 0,
                color: "var(--layers-ink)",
                fontSize: "var(--text-md)",
                fontWeight: 600,
                lineHeight: 1.3,
                letterSpacing: "-0.005em",
              }}
            >
              {step.title}
            </h3>
            <div
              style={{
                marginTop: "var(--space-2)",
                color: "var(--fg-default)",
                fontSize: "var(--text-sm)",
                lineHeight: 1.65,
              }}
            >
              {step.body}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div style={{ overflowX: "auto", margin: "var(--space-2) 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--text-sm)",
          minWidth: 480,
        }}
      >
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "var(--space-3) var(--space-3)",
                  borderBottom: "1px solid var(--border-default)",
                  color: "var(--fg-subtle)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: "var(--space-3) var(--space-3)",
                    borderBottom: "1px solid var(--border-subtle)",
                    color:
                      j === 0 ? "var(--layers-ink)" : "var(--fg-default)",
                    fontWeight: j === 0 ? 500 : 400,
                    verticalAlign: "top",
                    lineHeight: 1.5,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
