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
  StepList,
} from "../_components";

/**
 * MCP Quickstart — public, hand-written.
 *
 * Tool table is mirrored from app/api/mcp/[transport]/route.ts. When tools
 * change, update the TOOLS constant below; there's no runtime introspection
 * because this page is statically renderable and the schemas don't change at
 * runtime.
 */

export const metadata: Metadata = {
  title: "MCP Quickstart · Layers",
  description:
    "Connect Claude Desktop, Cursor, Continue, or ChatGPT Desktop to Layers via the Model Context Protocol.",
};

const MCP_URL = "https://layers.mirrorfactory.ai/api/mcp/sse";

type Tool = {
  name: string;
  summary: string;
  args: { name: string; type: string; required: boolean; note?: string }[];
  returns: string;
  example: { input: string; output: string };
};

const TOOLS: Tool[] = [
  {
    name: "search_meetings",
    summary:
      "Semantic search over your transcripts and summaries. Returns meeting chunks ranked by similarity.",
    args: [
      { name: "query", type: "string", required: true, note: "Natural-language question or keywords." },
      { name: "limit", type: "number", required: false, note: "1–50, default 10." },
    ],
    returns:
      "Array of { meetingId, chunkText, chunkType, similarity, meetingTitle, meetingDate } — JSON-stringified in the text content block.",
    example: {
      input: `{"query": "what did we decide about pricing", "limit": 5}`,
      output: `[
  {
    "meetingId": "8a2c…",
    "meetingTitle": "Pricing review",
    "chunkType": "summary",
    "chunkText": "We agreed to launch Core at $20/mo …",
    "similarity": 0.84,
    "meetingDate": "2026-04-22T14:00:00Z"
  }
]`,
    },
  },
  {
    name: "get_meeting",
    summary:
      "Fetch the full meeting record — transcript, summary, action items, decisions, cost, status.",
    args: [{ name: "meeting_id", type: "string", required: true }],
    returns:
      "Full meeting row from Supabase, JSON-stringified. Returns the literal string \"Meeting not found\" when the id is missing or out of scope for the authenticated user.",
    example: {
      input: `{"meeting_id": "8a2c1d4e-…"}`,
      output: `{
  "id": "8a2c1d4e-…",
  "title": "Pricing review",
  "status": "completed",
  "duration_seconds": 1860,
  "summary": { "summary": "…", "actionItems": [...], "decisions": [...] },
  "text": "Alfonso: …"
}`,
    },
  },
  {
    name: "list_meetings",
    summary:
      "Recent meetings sorted by created_at desc. Use this before search_meetings when you need a quick scan.",
    args: [
      {
        name: "limit",
        type: "number",
        required: false,
        note: "1–100, default 20.",
      },
    ],
    returns:
      "Array of { id, title, status, duration, durationSeconds, date }. `duration` is rounded to whole minutes.",
    example: {
      input: `{"limit": 3}`,
      output: `[
  { "id": "8a2c…", "title": "Pricing review", "status": "completed",
    "duration": "31 min", "durationSeconds": 1860, "date": "2026-04-22T14:00:00Z" },
  { "id": "f1ab…", "title": "Hiring sync", "status": "completed",
    "duration": "22 min", "durationSeconds": 1320, "date": "2026-04-21T16:00:00Z" }
]`,
    },
  },
  {
    name: "get_transcript",
    summary: "Returns the raw transcript text of a meeting.",
    args: [{ name: "meeting_id", type: "string", required: true }],
    returns:
      "Plain-text transcript. Returns \"No transcript available\" if the meeting has none.",
    example: {
      input: `{"meeting_id": "8a2c1d4e-…"}`,
      output: `Alfonso: Let's lock pricing for the launch.
Sam: Core at $20 makes sense, Pro at $30…`,
    },
  },
  {
    name: "get_summary",
    summary:
      "Returns the AI-generated summary object — a structured summary, key decisions, and action items with owners and due dates.",
    args: [{ name: "meeting_id", type: "string", required: true }],
    returns:
      "Summary JSON-stringified ({ title, summary, actionItems[], decisions[] }), or the string \"No summary available\".",
    example: {
      input: `{"meeting_id": "8a2c1d4e-…"}`,
      output: `{
  "title": "Pricing review",
  "summary": "Decided on $20/$30 tiers. Stripe wired by next Friday.",
  "actionItems": [
    { "assignee": "Sam", "task": "Stripe price IDs", "dueDate": "2026-04-29" }
  ],
  "decisions": ["Core launches at $20/user/mo", "No annual discount at launch"]
}`,
    },
  },
  {
    name: "start_recording",
    summary:
      "Stub for parity with future client-driven workflows. Today this returns a notice telling the user to start a recording from the app UI at /record/live.",
    args: [],
    returns: "Plain-text instruction string.",
    example: {
      input: `{}`,
      output: `Recording must be started from the app UI. Navigate to /record/live in the Layers app.`,
    },
  },
  {
    name: "prepare_notes_push",
    summary:
      "Builds a scoped, ready-to-send notes payload (markdown + structured JSON) for an explicit MCP-client pull. Layers does not transmit anywhere — your client decides what to do with the payload.",
    args: [
      { name: "meeting_id", type: "string", required: true },
      {
        name: "trigger",
        type: "enum",
        required: false,
        note: "manual_push | meeting_completed | action_items_detected | decision_detected (default manual_push).",
      },
      {
        name: "destination",
        type: "string",
        required: true,
        note: "Free-form label, 1–80 chars (e.g. \"notion-product-notes\").",
      },
      {
        name: "include_transcript",
        type: "boolean",
        required: false,
        note: "Default false. When true, the full transcript is added to the markdown + payload.",
      },
    ],
    returns:
      "{ ready, meetingId, title, trigger, destination, generatedAt, actionItemCount, decisionCount, markdown, payload }. `ready: false` with `error` when the meeting can't be loaded.",
    example: {
      input: `{
  "meeting_id": "8a2c1d4e-…",
  "trigger": "meeting_completed",
  "destination": "notion-product-notes",
  "include_transcript": false
}`,
      output: `{
  "ready": true,
  "meetingId": "8a2c1d4e-…",
  "title": "Pricing review",
  "trigger": "meeting_completed",
  "destination": "notion-product-notes",
  "generatedAt": "2026-05-01T12:00:00.000Z",
  "actionItemCount": 1,
  "decisionCount": 2,
  "markdown": "# Pricing review\\n\\n…",
  "payload": { "summary": {…}, "actionItems": [...], "decisions": [...] }
}`,
    },
  },
  {
    name: "show_meeting_dashboard",
    summary:
      "Renders an interactive Claude MCP App dashboard of the user's recent meetings. Read-only, idempotent.",
    args: [
      {
        name: "limit",
        type: "number",
        required: false,
        note: "1–25, default 12.",
      },
    ],
    returns:
      "structuredContent: { meetings: [...] } plus a one-line text confirmation. The Claude client renders the dashboard from the bundled UI resource.",
    example: {
      input: `{"limit": 6}`,
      output: `Showing 6 recent Layers meetings.`,
    },
  },
];

const ALLOWED_REDIRECT_URIS = [
  "http://localhost:* / http://127.0.0.1:* / http://[::1]:* (loopback)",
  "claude://… (Claude Desktop)",
  "cursor://… (Cursor)",
  "continue://… (Continue)",
  "https://*.anthropic.com/…",
  "https://*.claude.ai/… and https://*.claude.com/…",
  "https://*.cursor.sh/…",
];

export default function McpDocsPage() {
  return (
    <DocShell
      kicker="01 · MCP Quickstart"
      title={
        <>
          Connect Layers to{" "}
          <em
            style={{
              fontStyle: "italic",
              fontWeight: 500,
              color: "var(--layers-mint)",
            }}
          >
            any MCP client.
          </em>
        </>
      }
      lede={
        <>
          Layers ships an OAuth-protected Model Context Protocol server.
          Eight tools, one connector URL, zero copy-pasted API keys. Pair it
          with Claude Desktop, Cursor, Continue, or any other MCP-aware
          client.
        </>
      }
    >
      <Section id="connector-url" title="Connector URL">
        <P>
          Add this URL as a remote MCP server in your client. The first call
          triggers the OAuth dance — the client opens a browser, you sign in
          to Layers, and the bearer token is stored locally by the client.
        </P>
        <CodeBlock label="MCP server URL">{MCP_URL}</CodeBlock>
        <Callout tone="info" title="Streamable transport">
          The path is <Code>/api/mcp/sse</Code> and the route handles GET (SSE),
          POST (JSON-RPC), and DELETE. Most clients only need the base URL —
          they negotiate transport automatically.
        </Callout>
      </Section>

      <Section id="claude-desktop" title="Quickstart — Claude Desktop">
        <StepList
          steps={[
            {
              title: "Open Claude Desktop → Settings → Connectors",
              body: (
                <P>
                  In recent Claude Desktop builds the &ldquo;Add custom
                  connector&rdquo; option lives under{" "}
                  <Code>Settings → Connectors → Advanced</Code>. Older builds
                  expose it under <Code>Developer</Code>.
                </P>
              ),
            },
            {
              title: "Paste the Layers connector URL",
              body: (
                <>
                  <P>
                    Use <Code>{MCP_URL}</Code>. Claude will discover the
                    OAuth metadata and present a sign-in window.
                  </P>
                  {/* screenshot: claude-add-connector */}
                </>
              ),
            },
            {
              title: "Authorize Layers",
              body: (
                <P>
                  Sign in with the same account you use for the web app.
                  Approve the requested scope (<Code>mcp:tools</Code>). The
                  browser hands the bearer token back to Claude Desktop and
                  closes itself.
                </P>
              ),
            },
            {
              title: "Verify the eight tools appeared",
              body: (
                <P>
                  Open a new chat and type{" "}
                  <Code>list my recent meetings</Code>. Claude should call{" "}
                  <Code>list_meetings</Code> and return your library.
                </P>
              ),
            },
          ]}
        />
      </Section>

      <Section id="other-clients" title="Other MCP clients">
        <P>
          Any client that speaks remote MCP and supports OAuth 2.1 with PKCE
          will work. The setup pattern is identical: add a custom server, paste
          the URL, complete the browser sign-in.
        </P>
        <DataTable
          headers={["Client", "Where to add the server"]}
          rows={[
            [
              "Cursor",
              <>
                <Code>Settings → MCP → Add custom server</Code>. Paste the URL,
                save, restart Cursor once.
              </>,
            ],
            [
              "Continue",
              <>
                Edit <Code>~/.continue/config.json</Code> and add an entry
                under <Code>mcpServers</Code> with{" "}
                <Code>type: &quot;remote&quot;</Code> and the URL above.
              </>,
            ],
            [
              "ChatGPT Desktop",
              <>
                <Code>Settings → Connectors → Custom MCP server</Code>. Paste
                the URL — ChatGPT registers itself via Dynamic Client
                Registration.
              </>,
            ],
            [
              "Anything else",
              <>
                If the client supports remote MCP + OAuth, paste the URL. The
                metadata at{" "}
                <Code>/.well-known/oauth-protected-resource</Code> drives
                discovery.
              </>,
            ],
          ]}
        />
      </Section>

      <Section id="tools" title="The eight tools">
        <P>
          All tools require an authenticated bearer token. Inputs are validated
          with Zod on the server. Outputs are returned in the standard MCP{" "}
          <Code>content</Code> array — most are JSON-stringified text blocks.
        </P>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "clamp(20px, 2vw, 32px)",
          }}
        >
          {TOOLS.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      </Section>

      <Section id="oauth" title="OAuth + Dynamic Client Registration">
        <P>
          Layers implements OAuth 2.1 with PKCE plus RFC 7591 Dynamic Client
          Registration. MCP clients self-register before the first auth flow,
          so there are no API keys to issue or rotate by hand.
        </P>
        <P>The flow:</P>
        <StepList
          steps={[
            {
              title: "Discovery",
              body: (
                <P>
                  Client fetches{" "}
                  <Code>/.well-known/oauth-protected-resource</Code> from the
                  MCP URL, then{" "}
                  <Code>/.well-known/oauth-authorization-server</Code> for the
                  endpoints.
                </P>
              ),
            },
            {
              title: "Registration",
              body: (
                <P>
                  Client POSTs to <Code>/api/oauth/register</Code> with its
                  desired <Code>redirect_uris</Code>. Layers issues a
                  stateless <Code>client_id</Code> if every URI is on the
                  allow-list (see below).
                </P>
              ),
            },
            {
              title: "Authorization",
              body: (
                <P>
                  Browser is sent to <Code>/api/oauth/authorize</Code> with a
                  PKCE challenge. The user signs in, sees the consent screen
                  at <Code>/api/oauth/consent</Code>, and is redirected back
                  with an authorization code.
                </P>
              ),
            },
            {
              title: "Token exchange",
              body: (
                <P>
                  Client trades the code for a bearer + refresh token at{" "}
                  <Code>/api/oauth/token</Code>. The token is presented as{" "}
                  <Code>Authorization: Bearer …</Code> on every MCP call.
                </P>
              ),
            },
          ]}
        />
        <Callout tone="info" title="Allowed redirect URIs">
          Registration is rejected if any <Code>redirect_uri</Code> falls
          outside this allow-list:
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 1.7 }}>
            {ALLOWED_REDIRECT_URIS.map((line) => (
              <li key={line} style={{ marginBottom: 4 }}>
                <Code>{line}</Code>
              </li>
            ))}
          </ul>
          If your client uses a different scheme, email{" "}
          <a
            href="mailto:support@mirrorfactory.ai"
            style={{ color: "var(--layers-blue)" }}
          >
            support@mirrorfactory.ai
          </a>{" "}
          and we&rsquo;ll add it.
        </Callout>
      </Section>

      <Section id="rate-limits" title="Rate limits">
        <P>
          Per-token rate limits apply to MCP tool calls and protect against
          runaway agent loops. Concrete numbers ship with{" "}
          <Link href="/docs/errors" style={{ color: "var(--layers-blue)" }}>
            error codes
          </Link>{" "}
          — see the <Code>rate_limited</Code> entry there for HTTP status,
          retry guidance, and headers.
        </P>
        <Callout tone="warn" title="Coming soon">
          Concrete limits land alongside PROD-404. This page will quote the
          numbers as soon as they&rsquo;re live; in the meantime, expect a 429
          if you fan out 50+ tool calls per second from a single client.
        </Callout>
      </Section>

      <Section id="revoking" title="Revoking access">
        <P>
          You can revoke a connected client at any time. Each revocation kills
          the bearer + refresh token immediately; the client will fall back to
          the OAuth flow on its next call.
        </P>
        <P>
          The dashboard UI lives at <Code>/settings/integrations</Code> and is
          shipping with PROD-403. Until then, hit the revoke endpoint
          directly:
        </P>
        <CodeBlock label="POST /api/oauth/revoke">{`curl -X POST https://layers.mirrorfactory.ai/api/oauth/revoke \\
  -H "Authorization: Bearer <your-token>" \\
  -d "token=<token-to-revoke>"`}</CodeBlock>
        <Callout tone="warn" title="UI coming soon">
          The visual integrations page (PROD-403) is in backlog. The endpoint
          above is stable and safe to script today.
        </Callout>
      </Section>
    </DocShell>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <article
      id={`tool-${tool.name}`}
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
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Code>{tool.name}</Code>
        <P>{tool.summary}</P>
      </header>
      {tool.args.length === 0 ? (
        <p
          style={{
            margin: 0,
            color: "var(--fg-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          <strong>Arguments:</strong> none.
        </p>
      ) : (
        <div>
          <h4
            style={{
              margin: "0 0 var(--space-2)",
              fontSize: "var(--text-xs)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--fg-subtle)",
              fontWeight: 600,
            }}
          >
            Arguments
          </h4>
          <DataTable
            headers={["Name", "Type", "Required", "Notes"]}
            rows={tool.args.map((arg) => [
              <Code key="n">{arg.name}</Code>,
              <Code key="t">{arg.type}</Code>,
              arg.required ? "yes" : "no",
              arg.note ?? "",
            ])}
          />
        </div>
      )}
      <div>
        <h4
          style={{
            margin: "0 0 var(--space-2)",
            fontSize: "var(--text-xs)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--fg-subtle)",
            fontWeight: 600,
          }}
        >
          Returns
        </h4>
        <P>{tool.returns}</P>
      </div>
      <div
        style={{
          display: "grid",
          gap: "var(--space-3)",
          gridTemplateColumns: "minmax(0, 1fr)",
        }}
      >
        <CodeBlock label="Example input">{tool.example.input}</CodeBlock>
        <CodeBlock label="Example output">{tool.example.output}</CodeBlock>
      </div>
    </article>
  );
}
