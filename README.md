# audio-layer

Multi-platform audio intake and meeting transcription app. Built on Next.js 15 + Vercel AI SDK v6 + AssemblyAI Universal-3 Pro. Ships as a web app, a Tauri desktop shell (macOS / Windows / Linux), and a Capacitor mobile shell (iOS / Android) — all wrapping the same hosted backend.

---

## Start here

| You are | Go to |
|---|---|
| Running this for the first time | [SETUP.md](./SETUP.md) — env vars, API keys, dashboard clicks |
| Trying to understand the code | [ARCHITECTURE.md](./ARCHITECTURE.md) — request flow, state, observability, auth |
| Looking for a specific route | [API.md](./API.md) — every endpoint, request/response shape |
| Calculating costs / margins | [COSTS.md](./COSTS.md) — per-meeting math, at scale, break-even |
| Operating the deployed app | [OPERATIONS.md](./OPERATIONS.md) — daily runbook, monitoring, troubleshooting, testing |
| Building desktop / mobile binaries | [PLATFORMS.md](./PLATFORMS.md) — toolchain, signing, distribution per platform |
| Checking what's not yet proven | [VERIFICATION_GAPS.md](./VERIFICATION_GAPS.md) — honest list of what's untested end-to-end |
| Writing code as an AI agent | [AGENTS.md](./AGENTS.md) — locked decisions, file map, do-not-do list |

Platform-specific docs live next to the code:
- [src-tauri/README.md](./src-tauri/README.md) — desktop shell internals
- [mobile/README.md](./mobile/README.md) — Capacitor setup workflow

---

## Quickstart — web only

Minimum keys to record one meeting end to end:

```bash
git clone https://github.com/mirror-factory/audio-layer
cd audio-layer
pnpm install
cp .env.example .env.local

# Edit .env.local and set at least:
#   AI_GATEWAY_API_KEY=vck_...       (vercel.com → AI Gateway)
#   ASSEMBLYAI_API_KEY=...            (assemblyai.com, free $50 credit)

pnpm dev
# → http://localhost:3000/record
```

Upload a short audio clip or record from your mic; you'll get a speaker-segmented transcript + AI summary + structured intake form in 10–30 seconds. Without Supabase configured, meetings live in-memory and vanish on reload — see [SETUP.md](./SETUP.md) for the full tier stack (persistence, auth, billing, observability).

## Quickstart — desktop or mobile

```bash
# Desktop (macOS / Windows / Linux)
cargo install tauri-cli --version "^2.0"
cargo tauri dev

# Mobile (on a Mac with Xcode + Android Studio)
bash mobile/setup.sh
npx cap open ios       # or: npx cap open android
```

Full prerequisites + build + distribution: [PLATFORMS.md](./PLATFORMS.md).

---

## Tech stack

```
Frontend     Next.js 15 (App Router) · React 19 · Tailwind v4 · TypeScript
Backend      Next.js Route Handlers (Node.js runtime) on Vercel
Auth         Supabase (anonymous on first visit, magic link upgrade)
DB           Supabase Postgres (meetings + profiles, RLS enforced)
LLM          Vercel AI Gateway (Claude Sonnet 4.6 default, user-selectable)
STT          AssemblyAI Universal-3 Pro (batch + streaming, direct)
Billing      Stripe (Checkout + signed webhook → profiles)
Observability Langfuse via OTel (auto-traces every AI SDK call)
Export       @react-pdf/renderer + Markdown serializer
Desktop      Tauri 2.x (cpal mic + macOS ScreenCaptureKit system audio)
Mobile       Capacitor 8 (WebView wraps live app)
Tests        Vitest (106) + Playwright e2e (6 specs)
```

## Repo layout

```
app/            Next.js routes (pages + API)
components/    React components
lib/
  ai/           AI SDK integration + telemetry
  assemblyai/   STT client + summary + intake
  billing/      Pricing tables, quota, usage aggregator
  meetings/     Store (Supabase + in-memory) + export
  stripe/       Client + profile helpers
  supabase/     Schema + auth helpers
  observability/ Langfuse client
public/         Static assets + PWA manifest + audio worklet
src-tauri/      Desktop shell (Rust)
mobile/         Capacitor config + setup scripts
tests/          Vitest unit + Playwright e2e
scripts/        Compliance + drift + load test + research helpers
docs/           Generated reference
```

Full file-by-file map: [ARCHITECTURE.md § Key modules](./ARCHITECTURE.md).

---

## Gates

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest (106 passing)
pnpm test:e2e    # playwright (6 specs)
pnpm compliance  # 12 pattern checks from the starter kit
pnpm build       # next build — 23 routes
pnpm test:all    # everything above, sequentially
```

Husky pre-commit runs typecheck + test. Pre-push re-runs them and compliance.

---

## Project status

- Web app: **ready for production** once env vars are set and schema.sql is run.
- Cost + usage tracking: wired end to end (`/usage`, `/meetings/[id]` cost panel, Langfuse overlay).
- Auth: anonymous + email magic link.
- Billing: Stripe Checkout + webhook. Paywall at 25 free meetings.
- Desktop: code in place, needs compile verification on a Mac (Rust toolchain not in this build env).
- Mobile: scaffold + setup automation, needs `bash mobile/setup.sh` on a Mac with Xcode + Android SDK.

See [VERIFICATION_GAPS.md](./VERIFICATION_GAPS.md) for the honest list of what's not yet proven end to end.

---

## License

All rights reserved — Mirror Factory. Internal project; not open source.
