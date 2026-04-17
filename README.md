# audio-layer

The first standalone product built on the Layers platform by The Near Factory.

Bootstrapped from [mirror-factory/vercel-ai-starter-kit](https://github.com/mirror-factory/vercel-ai-starter-kit) — Next.js 15 + AI SDK v6 + TypeScript + Tailwind v4 + pnpm, with Langfuse observability, Claude Code hooks, registries, and enforcement gates.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in AI_GATEWAY_API_KEY, LANGFUSE_*, etc.
pnpm dev
```

Then open:
- http://localhost:3000 — Hub
- http://localhost:3000/record — upload or record audio → transcript + summary
- http://localhost:3000/chat — reference chat with tool calls
- http://localhost:3000/observability — AI call logs / costs / errors

## Gates

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest (unit + registry-sync)
pnpm compliance  # 12 automated checks from the starter kit
pnpm build       # next build
pnpm lint        # eslint flat config
```

Husky pre-commit runs typecheck + test; pre-push re-runs them plus compliance.

## What's wired

- **AI SDK v6** via `@ai-sdk/gateway` — routing, fallbacks, semantic caching
- **Langfuse OTEL** — auto-tracing for every `generateText` / `streamText` call (see `instrumentation.ts` + `lib/langfuse-setup.ts`)
- **Telemetry middleware** — `withTelemetry()` wraps AI calls, feeds the `/observability` dashboard
- **Tool registry** — `lib/ai/tool-meta.ts` single source of truth, enforced by registry-sync tests
- **Claude Code hooks** — `.claude/hooks/*.py` for session startup, reground, format
- **Skills** — `.claude/skills/*` for observability-debug, wire-telemetry, compliance-fix, visual-qa, context7-first
- **Nightly CI** — `.github/workflows/nightly.yml`
- **Playwright** — smoke, visual-regression, mobile
- **Research cache** — `.claude/research/` with freshness enforcement

## Product stack (locked)

| Layer | Choice |
|---|---|
| Web app (core) | Next.js 15 + AI SDK v6, hosted on Vercel |
| iOS + Android | Capacitor wrapping the static-exported web app + native audio plugins |
| macOS + Windows | Tauri (not Electron) — thin OS-webview shell, Rust bridge for system audio (Core Audio / ScreenCaptureKit / WASAPI) |
| Transcription — streaming | **AssemblyAI Universal-3 Pro** (`u3-rt-pro`, wss://api.assemblyai.com/v3/realtime/ws) — direct, not via Gateway |
| Transcription — batch | **AssemblyAI Universal-3 Pro** (`speech_model: 'best'`) — direct, not via Gateway |
| Summary LLM | Vercel AI Gateway (default `anthropic/claude-sonnet-4-6`) |
| Observability | Langfuse OTEL (auto-traces every LLM call) + in-app `/observability` dashboard |

All front-ends (web, mobile, desktop) call the same hosted `https://<app>.vercel.app/api/*` routes. Audio capture is native per-platform; uploads/streams go to the server-side AssemblyAI integration.

## V1 pipeline (shipped)

`/record` → `POST /api/transcribe` → AssemblyAI Universal-3 Pro batch (`speech_model: 'best'`) → `GET /api/transcribe/[id]` (poll every 3s) → on completion, Gateway-routed Claude Sonnet 4.6 runs `generateObject` against `MeetingSummarySchema` → render speaker-segmented transcript + structured summary (key points, decisions, action items, participants).

Every LLM call goes through `withTelemetry()` → Langfuse + `/observability`.

## Next up

Streaming transcription (AssemblyAI `u3-rt-pro` WebSocket) for live captions. Then Tauri shell with native system-audio capture (Core Audio / ScreenCaptureKit / WASAPI). Then Capacitor for mobile.
