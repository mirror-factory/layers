/**
 * /docs — renders the MFDR and other documentation inline.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TopBar } from "@/components/top-bar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DocsPage() {
  let mfdrContent = "";
  let readmeContent = "";
  try {
    mfdrContent = await readFile(
      join(process.cwd(), "docs/mfdr/MFDR-001.md"),
      "utf-8",
    );
  } catch {
    mfdrContent = "# Document not found\n\nMFDR-001.md could not be loaded.";
  }
  try {
    readmeContent = await readFile(
      join(process.cwd(), "README.md"),
      "utf-8",
    );
  } catch {
    readmeContent = "";
  }

  const mfdrHtml = markdownToHtml(mfdrContent);
  const readmeHtml = readmeContent ? markdownToHtml(readmeContent) : "";

  return (
    <main
      className="min-h-dvh px-4 md:px-6"
      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <TopBar title="Docs" />
      <div className="mx-auto max-w-3xl">

        <nav className="mb-8 flex flex-wrap gap-2 text-sm">
          <a
            href="#readme"
            className="px-3 py-1.5 rounded-md min-h-[44px] flex items-center"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-primary)",
            }}
          >
            README
          </a>
          <a
            href="#mfdr-001"
            className="px-3 py-1.5 rounded-md min-h-[44px] flex items-center"
            style={{
              backgroundColor: "var(--accent-muted)",
              color: "var(--accent)",
            }}
          >
            MFDR-001: Architecture
          </a>
        </nav>

        {readmeHtml && (
          <article
            id="readme"
            className="prose-custom"
            style={{ marginBottom: "var(--space-3xl)" }}
            dangerouslySetInnerHTML={{ __html: readmeHtml }}
          />
        )}

        <article
          id="mfdr-001"
          className="prose-custom"
          dangerouslySetInnerHTML={{ __html: mfdrHtml }}
        />
      </div>

      <style>{`
        .prose-custom {
          font-size: 14px;
          line-height: 1.7;
          color: var(--text-secondary);
          max-width: 75ch;
        }
        .prose-custom h1 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 2rem 0 0.75rem;
          letter-spacing: -0.01em;
        }
        .prose-custom h2 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 2rem 0 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .prose-custom h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 1.5rem 0 0.5rem;
        }
        .prose-custom p {
          margin: 0.5rem 0;
        }
        .prose-custom strong {
          color: var(--text-primary);
          font-weight: 600;
        }
        .prose-custom em {
          color: var(--text-muted);
        }
        .prose-custom ul, .prose-custom ol {
          margin: 0.5rem 0;
          padding-left: 1.25rem;
        }
        .prose-custom li {
          margin: 0.25rem 0;
        }
        .prose-custom li input[type="checkbox"] {
          margin-right: 0.5rem;
        }
        .prose-custom code {
          font-family: "Geist Mono", ui-monospace, monospace;
          font-size: 0.85em;
          padding: 0.15em 0.4em;
          border-radius: 4px;
          background: var(--bg-tertiary);
          color: var(--accent);
        }
        .prose-custom pre {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .prose-custom pre code {
          background: none;
          padding: 0;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .prose-custom table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.85rem;
        }
        .prose-custom th {
          text-align: left;
          font-weight: 600;
          color: var(--text-primary);
          padding: 0.5rem;
          border-bottom: 1px solid var(--border);
        }
        .prose-custom td {
          padding: 0.5rem;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
        }
        .prose-custom hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 1.5rem 0;
        }
        .prose-custom a {
          color: var(--accent);
          text-decoration: none;
        }
        .prose-custom a:hover {
          text-decoration: underline;
        }
        .prose-custom blockquote {
          border-left: 2px solid var(--accent);
          padding-left: 1rem;
          margin: 1rem 0;
          color: var(--text-muted);
        }
      `}</style>
    </main>
  );
}

/** Minimal markdown → HTML. Handles headings, bold, italic, code, tables, lists, links, hrs. */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let inTable = false;
  let inList = false;
  let listType: "ul" | "ol" = "ul";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        out.push("</code></pre>");
        inCodeBlock = false;
      } else {
        out.push("<pre><code>");
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      out.push(escapeHtml(line));
      out.push("\n");
      continue;
    }

    // Close table if we're in one and hit a non-table line
    if (inTable && !line.startsWith("|")) {
      out.push("</tbody></table>");
      inTable = false;
    }

    // Close list if we're in one and hit a non-list line
    if (inList && !line.match(/^(\s*[-*+]|\s*\d+\.|\s*- \[[ x]\])\s/)) {
      out.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
    }

    // Horizontal rules
    if (line.match(/^---+$/)) {
      out.push("<hr />");
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Tables
    if (line.startsWith("|")) {
      const cells = line.split("|").filter(Boolean).map((c) => c.trim());
      if (!inTable) {
        out.push("<table><thead><tr>");
        cells.forEach((c) => out.push(`<th>${inline(c)}</th>`));
        out.push("</tr></thead><tbody>");
        inTable = true;
        // Skip separator row
        if (lines[i + 1]?.match(/^\|[\s-|:]+\|?$/)) i++;
      } else {
        out.push("<tr>");
        cells.forEach((c) => out.push(`<td>${inline(c)}</td>`));
        out.push("</tr>");
      }
      continue;
    }

    // Lists
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    const checkMatch = line.match(/^(\s*)- \[([ x])\]\s+(.+)$/);
    if (checkMatch) {
      if (!inList) { out.push("<ul>"); inList = true; listType = "ul"; }
      const checked = checkMatch[2] === "x" ? "checked disabled" : "disabled";
      out.push(`<li><input type="checkbox" ${checked} />${inline(checkMatch[3])}</li>`);
      continue;
    }
    if (ulMatch) {
      if (!inList) { out.push("<ul>"); inList = true; listType = "ul"; }
      out.push(`<li>${inline(ulMatch[2])}</li>`);
      continue;
    }
    if (olMatch) {
      if (!inList) { out.push("<ol>"); inList = true; listType = "ol"; }
      out.push(`<li>${inline(olMatch[2])}</li>`);
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      continue;
    }

    // Paragraphs
    out.push(`<p>${inline(line)}</p>`);
  }

  if (inList) out.push(listType === "ul" ? "</ul>" : "</ol>");
  if (inTable) out.push("</tbody></table>");
  if (inCodeBlock) out.push("</code></pre>");

  return out.join("\n");
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
