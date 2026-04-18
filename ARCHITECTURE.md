# Architecture

How the pieces fit together. Read this after `SETUP.md` to understand what the code is actually doing.

## System overview

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Web browser   │   │  Tauri desktop  │   │ Capacitor mobile│
│   (Chromium /   │   │  (OS WebView    │   │ (WKWebView /    │
│    Safari /     │   │   + Rust bridge │   │  Android WebView│
│    Firefox)     │   │   for audio)    │   │  + native audio)│
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └──────────┬──────────┴──────────┬──────────┘
                    │  HTTPS              │
                    ▼                     ▼
         ┌──────────────────────────────────────────┐
         │   Next.js 15 App (hosted on Vercel)      │
         │                                          │
         │   Route handlers run on Node runtime     │
         │   — every /api/* is a serverless fn.     │
         │                                          │
         │   Middleware (edge) signs anonymous      │
         │   Supabase users on first request.       │
         └────┬───────────┬──────────┬───────────┬──┘
              │           │          │           │
              ▼           ▼          ▼           ▼
       ┌──────────┐┌──────────┐┌──────────┐┌──────────┐
       │AssemblyAI││Vercel AI ││ Supabase ││  Stripe  │
       │ (direct, ││ Gateway  ││ Postgres ││Checkout +│
       │  STT +   ││(LLM: sum-││ + Auth + ││ webhooks │
       │ streaming││ mary,    ││   RLS    ││          │
       │  tokens) ││ intake)  ││          ││          │
       └──────────┘└──────────┘└──────────┘└──────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   Langfuse   │
                   │ (OTel spans, │
                   │  token + $   │
                   │  tracking)   │
                   └──────────────┘
```

Every client — browser, Tauri window, Capacitor WebView — hits the **same hosted Next.js backend**. There is no mobile-only or desktop-only API. Audio capture is native-specific; everything downstream is shared.

## Request flow — batch recording

```
 User                  Browser            /api/transcribe          AssemblyAI              Gateway                  Supabase
  │                      │                       │                      │                        │                        │
  │──drop audio file─────▶                       │                      │                        │                        │
  │                      │──POST multipart──────▶│                      │                        │                        │
  │                      │                       │──checkQuota()────────│────────────────────────│───meetings count───────▶│
  │                      │                       │                      │                        │                        │
  │                      │                       │──files.upload────────▶                        │                        │
  │                      │                       │──transcripts.submit──▶                        │                        │
  │                      │                       │                      │                        │                        │
  │                      │                       │──insert meeting (processing)──────────────────│────────────────────────▶│
  │                      │◀─202 { id, status }───│                      │                        │                        │
  │                      │                       │                      │                        │                        │
  │ (every 3s)           │──GET /api/transcribe/[id]────────────────────▶│                        │                        │
  │                      │                       │──transcripts.get─────▶                        │                        │
  │                      │                       │                      │                        │                        │
  │                      │                       │   (status=completed) │                        │                        │
  │                      │                       │──summarizeMeeting + extractIntakeForm─────────▶│                        │
  │                      │                       │   (parallel via Promise.allSettled)           │                        │
  │                      │                       │                      │                        │                        │
  │                      │                       │──update meeting + cost_breakdown──────────────│────────────────────────▶│
  │                      │                       │                      │                        │                        │
  │                      │◀─{ transcript, summary, intake, cost }─┤      │                        │                        │
  │                      │──router.push /meetings/[id]───────────▶│     │                        │                        │
  │                      │                       │                      │                        │                        │
  │                      │                       │   after(flushLangfuse)───────────────────────────────────▶ Langfuse
  │◀─/meetings/[id] renders transcript + cost panel + summary + intake──┤                        │                        │
```

Key invariants:
- **Quota gate runs first** — HTTP 402 before any AssemblyAI call.
- **Meeting row exists before work starts** — the placeholder is visible in `/meetings` while processing.
- **`Promise.allSettled` on LLM calls** — summary failure doesn't block intake, or vice versa.
- **`cost_breakdown` persists on every completed row** — STT price × duration + each LLM call's tokens × pricing table.
- **`after(flushLangfuse)` on every AI-calling route** — forces OTel span upload before Vercel freezes the function.

## Request flow — live streaming

```
 User          Browser              /api/transcribe/stream/token       AssemblyAI WS
  │              │                              │                           │
  │─click Start─▶│                              │                           │
  │              │──POST ─────────────────────▶ │                           │
  │              │                              │──createTemporaryToken────▶│
  │              │                              │──insert meeting row──────▶ Supabase
  │              │◀─{ token, meetingId }────────│                           │
  │              │                              │                           │
  │              │── getUserMedia + AudioContext + AudioWorklet (or cpal via Tauri) ──┐
  │              │                              │                           │        │
  │              │── open WS direct to wss://api.assemblyai.com/v3/realtime/ws?token=...  ▶
  │              │◀ TurnEvent (partial) ─── TurnEvent (end_of_turn=true) ───┤
  │              │── live UI updates ──         │                           │
  │              │                              │                           │
  │─click Stop──▶│                              │                           │
  │              │── close WS                   │                           │
  │              │── POST /api/transcribe/stream/finalize─▶                 │
  │              │                              │──summarize + extractIntakeForm (parallel)
  │              │                              │──update meeting (completed + cost_breakdown) ──▶ Supabase
  │              │                              │──after(flushLangfuse) ────────▶ Langfuse
  │              │◀─{ meeting }─────────────────│                           │
  │◀─/meetings/[id]                             │                           │
```

The browser never sees the AssemblyAI API key. Tokens are 10-minute TTL, 1-hour max session.

## State model

### Supabase tables

```sql
-- schema.sql, run once per project
meetings (
  id                text        PRIMARY KEY,          -- AssemblyAI id (batch) or UUID (streaming)
  user_id           uuid        REFERENCES auth.users,
  status            text,                              -- queued | processing | completed | error
  title             text,                              -- generated by LLM
  text              text,                              -- full joined transcript
  utterances        jsonb,                             -- speaker-segmented turns
  duration_seconds  real,
  summary           jsonb,                             -- MeetingSummarySchema
  intake_form       jsonb,                             -- IntakeFormSchema
  cost_breakdown    jsonb,                             -- stt + llm call records + total USD
  error             text,
  created_at        timestamptz,
  updated_at        timestamptz
);

profiles (
  user_id              uuid        PRIMARY KEY REFERENCES auth.users,
  stripe_customer_id   text        UNIQUE,
  subscription_status  text,                           -- active | trialing | past_due | canceled | null
  subscription_tier    text,                           -- core | pro | null
  current_period_end   timestamptz,
  created_at           timestamptz,
  updated_at           timestamptz
);
```

Both have **RLS enabled**. `meetings` has four owner-only policies; `profiles` has SELECT-only for the owner (writes happen via service-role from Stripe webhook).

### In-memory fallback

When `SUPABASE_URL` is unset, `getMeetingsStore()` returns a process-wide `InMemoryMeetingsStore` (FIFO, 500 entries). Useful for local dev without Supabase. Lost on redeploy — never use in production.

### Per-request vs singleton clients

- **Supabase**: per-request (needs cookie session). `lib/supabase/user.ts` builds one via `@supabase/ssr`.
- **Service-role Supabase**: singleton (no session context). `lib/supabase/server.ts`. Used only by Stripe webhook writes and quota reads.
- **AssemblyAI, Stripe, Langfuse**: singletons, cached on first call.
- **AI SDK**: no persistent client — `generateText`/`generateObject` are per-call.

## Observability

Two layers:

1. **Always-on in-memory** — `lib/ai/telemetry.ts` keeps a 500-entry ring buffer. Every AI call logs cost, tokens, model, duration, finish reason. `/observability` reads from it. Lost across serverless instances.
2. **Langfuse** (when configured) — OTel spans uploaded via `LangfuseSpanProcessor`. Every AI SDK call auto-instruments. `after(flushLangfuse)` fires the upload before Vercel freezes the function. Cost is auto-computed for predefined models (Claude, GPT, Gemini).

`/usage` aggregates both: local `cost_breakdown` rows always, Langfuse overlay when its Daily Metrics API reports traces for the user.

## Auth

**Anonymous-by-default**, email upgrade opt-in.

1. Every non-static request hits `middleware.ts`. On first visit it calls `supabase.auth.signInAnonymously()` — the user gets a stable UUID in a cookie immediately.
2. `meetings` get `user_id` stamped to that UUID. RLS isolates per user.
3. When the user submits email on `/sign-in`, `signInWithOtp()` sends a magic link → `/auth/callback` exchanges it for a permanent session.
4. **Known gap**: the upgrade creates a NEW user; anonymous meetings become unreachable via RLS. `linkIdentity()` would fix this — not wired yet. See VERIFICATION_GAPS.md #6.

## Multi-platform strategy

The Next.js app is the **single backend**. Three shells wrap the same hosted URL:

| Shell | What it wraps | Native capability |
|---|---|---|
| Web | n/a | browser mic (getUserMedia) |
| Tauri desktop | OS webview | cpal mic + macOS ScreenCaptureKit system audio |
| Capacitor mobile | WKWebView / Android WebView | mic via getUserMedia inside WebView |

Tauri shell imports `@tauri-apps/api/core` through a string-variable dynamic import so the regular web bundle never resolves it. `LiveRecorder` detects `window.__TAURI__` and prefers the native capture channel; falls back to AudioWorklet in plain browsers.

Capacitor loads the live hosted URL via `server.url` in `capacitor.config.ts` — no static export. Same routes, same backend, same DB.

## Key modules

```
lib/
  ai/
    tool-meta.ts          Single source of truth for chat tools
    tools.ts              Tool definitions (server + client)
    telemetry.ts          withTelemetry() + in-memory ring buffer
    ai-logger.ts          Per-call console logger (cost, tokens, TTFT)
    model-router.ts       Model selection helpers (unused in current flow)
  assemblyai/
    client.ts             SDK factory (env-guarded, cached)
    schema.ts             MeetingSummarySchema (Zod)
    summary.ts            summarizeMeeting() via generateObject + usage capture
    intake.ts             IntakeFormSchema + extractIntakeForm()
    types.ts              Client↔Server transcribe response types
  meetings/
    types.ts              Meeting, MeetingListItem, MeetingUpdate
    store.ts              MeetingsStore interface + async factory
    store-supabase.ts     Per-request user-scoped Supabase impl
    store-in-memory.ts    Dev fallback (FIFO 500)
    export.ts             Markdown serializer
    pdf.tsx               @react-pdf/renderer document
  billing/
    quota.ts              checkQuota() — 25 free meetings, subscription bypass
    types.ts              MeetingCostBreakdown + UsageSummary shapes
    llm-pricing.ts        COST_PER_M_TOKENS + estimateLlmCost() + formatUsd()
    assemblyai-pricing.ts Per-hour rates + add-on stacking
    usage.ts              getUsageSummary() — local + Langfuse overlay
  stripe/
    client.ts             getStripe() + tier↔price-id mapping
    profiles.ts           Service-role profile helpers
  supabase/
    server.ts             Service-role client (bypasses RLS)
    user.ts               Per-request anon-role client (respects RLS)
    browser.ts            Client-component factory (for /sign-in)
    schema.sql            DDL — run once per project
  observability/
    langfuse-api.ts       Daily Metrics API client
  settings.ts             Server: cookie-backed model preferences
  settings-shared.ts      Shared types for client + server
  langfuse-setup.ts       OTel span processor + flushLangfuse()
  tauri/bridge.ts         Dynamic-import bridge for Tauri IPC

app/
  api/
    chat/                  Reference chat (streamText + tools)
    transcribe/            POST batch upload
    transcribe/[id]/       GET poll batch + summarize on completion
    transcribe/stream/     POST token + finalize for live sessions
    transcribe/[id]/export/  Markdown + PDF export
    meetings/              List + detail
    stripe/                Checkout + signed webhook
    ai-logs/               In-memory log feed for /observability
    settings/              Read + write cookie-backed prefs
    auth/                  Magic-link callback + sign-out
  record/                  Batch recorder UI
  record/live/             Streaming recorder UI
  meetings/                List + detail pages
  pricing/                 Three-tier landing
  sign-in/                 Magic-link form
  profile/                 Identity + subscription card
  usage/                   Lifetime + this-month totals
  settings/                Model picker
  observability/           AI call logs dashboard

components/
  live-recorder.tsx        AudioContext + Worklet + StreamingTranscriber (+ Tauri branch)
  live-transcript-view.tsx Finalized + partial turn rendering
  audio-recorder.tsx       MediaRecorder wrapper for batch mode
  transcript-view.tsx      Speaker-segmented transcript + summary sidebar
  intake-form-view.tsx     Structured IntakeForm panel
  meeting-cost-panel.tsx   Per-meeting STT + LLM + total
  meeting-detail-poller.tsx Client-side polling until status terminal

src-tauri/                 Tauri 2.x desktop shell
  src/lib.rs               cpal mic + macOS SCStream system audio + IPC channel
  Info.plist               NSMicrophoneUsageDescription + macOS 14+
  tauri.conf.json          Bundle identifier, window config

mobile/                    Capacitor config + setup scripts
  setup.sh                 Mac bootstrap (npx cap add + patchers)
  patches/                 Python + bash patchers for iOS plist, Android manifest, MainActivity

public/
  manifest.webmanifest     PWA manifest
  worklets/pcm-downsampler.js   AudioWorklet: 48k → 16k int16 LE
```
