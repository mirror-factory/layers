# Layer One

**v0.0.1** — Multi-platform meeting transcription and context extraction.

Record conversations, get AI-powered summaries, and extract structured data (budgets, timelines, decision makers, action items) — no meeting bot required.

Web + macOS (Tauri) + iOS (Capacitor). One codebase.

---

## Start here

| You want to | Read |
|---|---|
| Run it locally | [SETUP.md](./SETUP.md) |
| Understand the architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| See every API endpoint | [API.md](./API.md) |
| Know what it costs to run | [COSTS.md](./COSTS.md) |
| Operate it in production | [OPERATIONS.md](./OPERATIONS.md) |
| Build for desktop or mobile | [PLATFORMS.md](./PLATFORMS.md) |
| Check what's not yet proven | [VERIFICATION_GAPS.md](./VERIFICATION_GAPS.md) |
| Read the product decision record | [MFDR-001](./docs/mfdr/MFDR-001.md) |
| See the design system spec | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| See the full feature roadmap | [ROADMAP.md](./ROADMAP.md) |
| Write code as an AI agent | [AGENTS.md](./AGENTS.md) |

---

## Quickstart

```bash
git clone https://github.com/mirror-factory/audio-layer
cd audio-layer
pnpm install
cp .env.example .env.local
# Set AI_GATEWAY_API_KEY and ASSEMBLYAI_API_KEY — see SETUP.md
pnpm dev
```

Open `http://localhost:3000`. Tap "Start Recording" to begin.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind v4, TypeScript |
| LLM | Vercel AI Gateway → Claude, GPT, Gemini (user-selectable) |
| Transcription | AssemblyAI Universal-3 Pro (batch + real-time streaming) |
| Auth | Supabase (anonymous auto, email magic link, Google OAuth) |
| Database | Supabase Postgres with RLS |
| Billing | Stripe Checkout (Free / Core $15 / Pro $25) |
| Observability | Langfuse via OpenTelemetry |
| Email | Resend (transactional) |
| Desktop | Tauri 2.x (Rust, macOS system audio via ScreenCaptureKit) |
| Mobile | Capacitor 8 (WebView) |
| Tests | Vitest 106 unit + Playwright e2e |

---

## Deployed

| Service | URL |
|---|---|
| Web app | [audio-layer.vercel.app](https://audio-layer.vercel.app) |
| Supabase | Audio Layer project (us-east-1) |
| Stripe | Test mode |
| Langfuse | cloud.langfuse.com |

---

## Verification

```bash
pnpm typecheck        # tsc
pnpm test             # vitest — 106 tests
pnpm compliance       # 12 pattern checks
pnpm build            # next build
pnpm gates            # all of the above
```

---

## License

All rights reserved — Mirror Factory.
