import Link from "next/link";
import type { Metadata } from "next";
import {
  Callout,
  Code,
  CodeBlock,
  DataTable,
  DocShell,
  P,
  Section,
} from "../_components";

/**
 * REST API public reference.
 *
 * Each route entry is hand-typed against the source files:
 *   - app/api/meetings/route.ts        (GET list)
 *   - app/api/meetings/[id]/route.ts   (GET / DELETE one)
 *   - app/api/search/route.ts          (POST semantic search)
 *   - app/api/settings/route.ts        (GET / PUT user settings)
 *
 * If the source shape changes, update the corresponding ENDPOINTS entry below.
 */

export const metadata: Metadata = {
  title: "REST API · Layers",
  description:
    "Read meetings, fetch transcripts, and search your library over HTTP. Same OAuth bearer that powers the MCP server.",
};

const BASE_URL = "https://layers.mirrorfactory.ai";

type Endpoint = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  auth: "bearer" | "session";
  summary: string;
  request?: { kind: "query" | "body" | "params"; description: string };
  response: string;
  errors: string[];
  example?: { request?: string; response: string };
};

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/meetings",
    auth: "session",
    summary: "List the authenticated user's meetings, newest first.",
    request: {
      kind: "query",
      description:
        "limit (number, optional). Default 50, max 200. Out-of-range values are clamped silently.",
    },
    response:
      "Array<Meeting>. Each meeting includes id, title, status, durationSeconds, createdAt, summary, utterances and text. Use /api/meetings/{id} for the canonical record after first load.",
    errors: ["unauthorized", "internal_error"],
    example: {
      request: `curl ${BASE_URL}/api/meetings?limit=2 \\
  -H "Authorization: Bearer <token>"`,
      response: `[
  {
    "id": "8a2c1d4e-…",
    "title": "Pricing review",
    "status": "completed",
    "durationSeconds": 1860,
    "createdAt": "2026-04-22T14:00:00Z",
    "summary": { "summary": "…", "actionItems": [...], "decisions": [...] },
    "text": "Alfonso: …"
  }
]`,
    },
  },
  {
    method: "GET",
    path: "/api/meetings/{id}",
    auth: "session",
    summary: "Fetch one meeting by id.",
    request: {
      kind: "params",
      description: "id (string, required). UUID of the meeting.",
    },
    response:
      "Single Meeting object — same shape as the list entries, with the full transcript and utterances populated.",
    errors: ["unauthorized", "not_found", "validation_error", "internal_error"],
    example: {
      request: `curl ${BASE_URL}/api/meetings/8a2c1d4e-… \\
  -H "Authorization: Bearer <token>"`,
      response: `{
  "id": "8a2c1d4e-…",
  "title": "Pricing review",
  "status": "completed",
  "durationSeconds": 1860,
  "summary": { … },
  "utterances": [ { "speaker": "Alfonso", "text": "…" } ],
  "text": "Alfonso: …"
}`,
    },
  },
  {
    method: "DELETE",
    path: "/api/meetings/{id}",
    auth: "session",
    summary:
      "Delete an empty recording. Refuses to delete meetings that have transcript text, utterances, a summary, or more than 30 seconds of audio.",
    request: {
      kind: "params",
      description: "id (string, required).",
    },
    response: "{ ok: true } on success.",
    errors: [
      "unauthorized",
      "not_found",
      "validation_error",
      "forbidden",
      "internal_error",
    ],
    example: {
      request: `curl -X DELETE ${BASE_URL}/api/meetings/8a2c1d4e-… \\
  -H "Authorization: Bearer <token>"`,
      response: `{ "ok": true }`,
    },
  },
  {
    method: "POST",
    path: "/api/search",
    auth: "bearer",
    summary:
      "Semantic search over transcripts and summaries. Falls back to a substring match when the embeddings index returns nothing.",
    request: {
      kind: "body",
      description:
        "JSON: { query: string (1–500 chars, required), limit?: number (1–50) }.",
    },
    response:
      "{ results: Array<SearchHit>, mode: \"semantic\" | \"text\" | \"none\" }. Each hit has meetingId, chunkText, chunkType, similarity, meetingTitle, meetingDate.",
    errors: [
      "unauthorized",
      "validation_error",
      "rate_limited",
      "internal_error",
    ],
    example: {
      request: `curl -X POST ${BASE_URL}/api/search \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "what did we decide about pricing", "limit": 5}'`,
      response: `{
  "mode": "semantic",
  "results": [
    {
      "meetingId": "8a2c…",
      "meetingTitle": "Pricing review",
      "chunkType": "summary",
      "chunkText": "We agreed to launch Core at $20/mo …",
      "similarity": 0.84,
      "meetingDate": "2026-04-22T14:00:00Z"
    }
  ]
}`,
    },
  },
  {
    method: "GET",
    path: "/api/settings",
    auth: "session",
    summary: "Read the authenticated user's model selection.",
    response:
      "Settings object — { summaryModel, batchSpeechModel, streamingSpeechModel } plus any defaults.",
    errors: ["unauthorized", "internal_error"],
    example: {
      request: `curl ${BASE_URL}/api/settings \\
  -H "Authorization: Bearer <token>"`,
      response: `{
  "summaryModel": "claude-opus-4-7",
  "batchSpeechModel": "whisper-large-v3",
  "streamingSpeechModel": "deepgram-nova-3"
}`,
    },
  },
  {
    method: "PUT",
    path: "/api/settings",
    auth: "session",
    summary:
      "Patch one or more model selections. Strict schema — unknown keys are rejected.",
    request: {
      kind: "body",
      description:
        "JSON with any subset of { summaryModel, batchSpeechModel, streamingSpeechModel }. Each value must be on the supported list (see lib/settings-shared).",
    },
    response: "Merged Settings object reflecting the new state.",
    errors: ["unauthorized", "validation_error", "internal_error"],
    example: {
      request: `curl -X PUT ${BASE_URL}/api/settings \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"summaryModel": "claude-opus-4-7"}'`,
      response: `{ "summaryModel": "claude-opus-4-7", … }`,
    },
  },
];

const STATUS_BADGES: Record<Endpoint["method"], { bg: string; ink: string }> = {
  GET: { bg: "var(--layers-mint-tint)", ink: "var(--tier-mint-text)" },
  POST: { bg: "var(--layers-blue-tint)", ink: "var(--tier-blue-text)" },
  PUT: { bg: "var(--layers-violet-tint)", ink: "var(--tier-violet-text)" },
  DELETE: {
    bg: "color-mix(in oklch, var(--signal-live) 20%, transparent)",
    ink: "var(--signal-live)",
  },
};

export default function ApiDocsPage() {
  return (
    <DocShell
      kicker="02 · REST API"
      title={
        <>
          A small, sturdy{" "}
          <em
            style={{
              fontStyle: "italic",
              fontWeight: 500,
              color: "var(--layers-mint)",
            }}
          >
            HTTP surface.
          </em>
        </>
      }
      lede={
        <>
          Layers is MCP-first, but every meeting is also reachable over plain
          HTTP. Same OAuth bearer as the MCP server, JSON in / JSON out, no
          custom envelopes.
        </>
      }
    >
      <Section id="auth" title="Authentication">
        <P>
          Every endpoint requires authentication. There are two ways to call
          them:
        </P>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "var(--fg-default)",
            fontSize: "var(--text-md)",
            lineHeight: 1.7,
          }}
        >
          <li>
            <strong>Bearer tokens.</strong> The OAuth tokens issued through
            the MCP flow (<Link href="/docs/mcp" style={{ color: "var(--layers-blue)" }}>see MCP Quickstart</Link>) work
            against the REST API too. Send <Code>Authorization: Bearer …</Code>.
          </li>
          <li>
            <strong>Browser session.</strong> When you call from a logged-in
            web app, the Supabase session cookie is enough. The route helpers
            in <Code>lib/with-route.ts</Code> resolve the user from either
            source.
          </li>
        </ul>
        <Callout tone="info" title="Errors are stable">
          All endpoints return JSON errors that map onto the codes documented
          on the{" "}
          <Link href="/docs/errors" style={{ color: "var(--layers-blue)" }}>
            errors page
          </Link>
          . Use the <Code>code</Code> field rather than the human-readable
          message for programmatic logic.
        </Callout>
      </Section>

      <Section id="endpoints" title="Endpoints">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "clamp(20px, 2vw, 32px)",
          }}
        >
          {ENDPOINTS.map((ep) => (
            <EndpointCard key={`${ep.method}-${ep.path}`} ep={ep} />
          ))}
        </div>
      </Section>

      <Section id="conventions" title="Conventions">
        <DataTable
          headers={["Topic", "Behaviour"]}
          rows={[
            [
              "Content type",
              "All requests with bodies use application/json. UTF-8.",
            ],
            [
              "Pagination",
              <>Cursor-style pagination is not exposed yet — use <Code>limit</Code> and order by <Code>createdAt</Code>.</>,
            ],
            [
              "Time format",
              "ISO 8601 with timezone (e.g. 2026-04-22T14:00:00Z).",
            ],
            [
              "IDs",
              "UUID v4. Treat them as opaque strings.",
            ],
            [
              "Versioning",
              "Routes are unversioned. Breaking changes ship behind a feature flag with a deprecation notice in this doc first.",
            ],
          ]}
        />
      </Section>
    </DocShell>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const badge = STATUS_BADGES[ep.method];
  return (
    <article
      id={`${ep.method.toLowerCase()}-${ep.path.replace(/[^a-z0-9]+/gi, "-")}`}
      style={{
        padding: "clamp(20px, 2.4vw, 28px)",
        borderRadius: "var(--radius-2xl)",
        border: "1px solid var(--border-default)",
        background: "var(--bg-surface)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 10px",
            borderRadius: "var(--radius-pill)",
            background: badge.bg,
            color: badge.ink,
            fontSize: "0.7rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {ep.method}
        </span>
        <Code>{ep.path}</Code>
        <span
          style={{
            color: "var(--fg-subtle)",
            fontSize: "var(--text-xs)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Auth: {ep.auth}
        </span>
      </header>
      <P>{ep.summary}</P>
      {ep.request ? (
        <div>
          <h4 style={fieldHeading}>
            {ep.request.kind === "query"
              ? "Query parameters"
              : ep.request.kind === "params"
                ? "Path parameters"
                : "Request body"}
          </h4>
          <P>{ep.request.description}</P>
        </div>
      ) : null}
      <div>
        <h4 style={fieldHeading}>Response</h4>
        <P>{ep.response}</P>
      </div>
      <div>
        <h4 style={fieldHeading}>Error codes</h4>
        <p
          style={{
            margin: 0,
            color: "var(--fg-default)",
            fontSize: "var(--text-sm)",
            lineHeight: 1.7,
          }}
        >
          {ep.errors.map((code, i) => (
            <span key={code}>
              <Link
                href={`/docs/errors#${code}`}
                style={{ color: "var(--layers-blue)", textDecoration: "none" }}
              >
                <Code>{code}</Code>
              </Link>
              {i === ep.errors.length - 1 ? "" : " · "}
            </span>
          ))}
        </p>
      </div>
      {ep.example ? (
        <div
          style={{
            display: "grid",
            gap: "var(--space-3)",
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
        >
          {ep.example.request ? (
            <CodeBlock label="Example request">{ep.example.request}</CodeBlock>
          ) : null}
          <CodeBlock label="Example response">{ep.example.response}</CodeBlock>
        </div>
      ) : null}
    </article>
  );
}

const fieldHeading: React.CSSProperties = {
  margin: "0 0 var(--space-2)",
  fontSize: "var(--text-xs)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--fg-subtle)",
  fontWeight: 600,
};
