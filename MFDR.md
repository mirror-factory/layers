# Mirror Factory Design Review — Layer One

**Product**: Layer One (audio-layer)
**Author**: Mirror Factory
**Date**: April 18, 2026
**Status**: V1 Development

---

## 1. Problem Statement

### What problem are we solving?

Professionals spend 31 hours per month in meetings (Atlassian, 2025). Of that time, 67% of meetings are considered unproductive. The core issue: critical information — decisions, action items, budgets, timelines, stakeholders — gets lost because nobody can listen and take comprehensive notes simultaneously.

Existing solutions fall into two categories:
- **Bot-based recorders** (Fireflies, Otter): A visible bot joins the meeting. Participants behave differently. IT departments block them. Privacy-conscious clients refuse them.
- **Manual note-takers**: Expensive, slow, and inconsistent.

### What's our hypothesis?

**If we capture meeting audio passively (no bot, no friction) and use AI to extract structured, actionable data (not just summaries), professionals will adopt it as a default tool because it's invisible during the conversation and instantly useful after.**

The differentiator is not transcription accuracy — that's table stakes. It's the structured extraction: budget figures, decision makers, requirements, pain points, timelines, and next steps pulled automatically into fields that can feed CRM, project management, and follow-up workflows.

---

## 2. Market Opportunity

### TAM / SAM / SOM

| Metric | Size | Source |
|---|---|---|
| **TAM**: Global AI meeting assistants market (2026) | $1.42B | Precedence Research |
| **TAM growth** to 2035 | $6.28B (18% CAGR) | Precedence Research |
| **AI note-taking market** (2026) | $740M | Precedence Research |
| **Meeting transcription segment** (fastest-growing) | $3.86B → $29.45B by 2034 (25.62% CAGR) | Industry analysis |
| **SAM**: North America AI meeting assistants | $420M (2025) → $2.2B (2035) | Precedence Research |
| **SOM**: Reachable market (solo professionals, small teams) | ~$50M (est.) | Internal |

### Competitive Landscape (April 2026)

| Competitor | Approach | Pricing | Key Weakness |
|---|---|---|---|
| **Granola** | Bot-free, system audio | $14/user/mo | Mac-only, no structured extraction |
| **Otter.ai** | Bot joins meeting | $16.99/user/mo | Bot visibility, privacy concerns |
| **Fireflies** | Bot + desktop app | $19/user/mo | Complex, enterprise-focused |
| **Fathom** | Bot-free, generous free tier | Free (5 AI summaries/mo) | Limited AI capabilities |
| **tl;dv** | Bot joins meeting | $18/user/mo | Bot visibility |

### Our Differentiation

1. **Multi-platform native** — web + macOS + iOS from one codebase. Competitors are web-only or single-platform.
2. **Structured intake extraction** — no competitor auto-extracts CRM-ready fields (budget, timeline, decision makers, pain points).
3. **Model selection** — user picks their LLM (Claude, GPT, Gemini). Competitors lock you to one.
4. **Cost transparency** — per-meeting cost breakdown shown to the user.
5. **Bot-free capture** — system audio via ScreenCaptureKit on macOS. No meeting bot, no participant notification.

---

## 3. Technical Architecture

### 3.1 Why This Stack?

#### Frontend: Next.js 15 (App Router) + React 19

**Decision**: Use Next.js as the universal web layer that all native shells load.

**Justification**:
- Server-side rendering for SEO and initial load performance
- API routes co-located with the frontend — no separate backend service
- App Router supports streaming, server components, and edge middleware
- React 19 server components reduce client bundle size
- Vercel deployment gives global CDN, edge functions, and zero-config CI/CD

**Alternatives considered**:
- **Remix**: Strong data loading patterns but smaller ecosystem, less Vercel integration
- **SvelteKit**: Excellent performance but smaller hiring pool and component ecosystem
- **Raw React SPA**: No SSR, no API routes, would need a separate backend

#### Desktop: Tauri 2.x (Rust)

**Decision**: Use Tauri instead of Electron for the desktop shell.

**Justification** (benchmarked, April 2026):
| Metric | Tauri | Electron |
|---|---|---|
| Bundle size | 2-10 MB | 80-200 MB |
| Memory usage (idle) | 30-40 MB | 200-300 MB |
| Startup time | <0.5s | 1-2s |
| Security | Rust memory safety | Node.js attack surface |

Tauri is 25x smaller bundles, 58-75% lower memory, and 4x faster startup. The only trade-off is Rust compilation time during development, which is acceptable for the performance gains in production.

**Critical capability**: Tauri + `screencapturekit` crate gives us native macOS system audio capture via ScreenCaptureKit — the same API Granola uses for bot-free meeting recording. This is not possible in Electron without third-party audio drivers.

**Sources**: [Tauri vs Electron 2026 Benchmarks](https://www.pkgpulse.com/blog/tauri-vs-electron-2026), [Gethopp Analysis](https://www.gethopp.app/blog/tauri-vs-electron)

#### Mobile: Capacitor 8 (WebView)

**Decision**: Use Capacitor to wrap the web app in native iOS/Android shells.

**Justification**:
- Shares the same Next.js codebase — no separate mobile app to maintain
- Access to native APIs (microphone, contacts, push notifications) via plugins
- WebView loads from the deployed Vercel URL — instant updates without App Store review
- Capacitor is Ionic's successor to Cordova with modern Swift/Kotlin bridges
- Smaller team can ship to 3 platforms from one codebase

**Alternatives considered**:
- **React Native**: Requires separate UI layer, different component model, can't share Next.js pages
- **Flutter**: Completely separate language (Dart), no code sharing with web
- **Native Swift/Kotlin**: Maximum performance but 3x development effort

#### Transcription: AssemblyAI Universal-3 Pro

**Decision**: Use AssemblyAI as the primary speech-to-text provider.

**Justification** (benchmarked, February 2026):
| Provider | WER (English) | WER (Multilingual) | Streaming Latency |
|---|---|---|---|
| **AssemblyAI Universal** | 8.1% | 6.8% | <300ms |
| Deepgram | 8.1% | 6.8% | <300ms |
| OpenAI Whisper | 6.5% | 7.4% | N/A (batch only) |

AssemblyAI offers:
- Both batch AND real-time streaming in a single API
- Speaker diarization built-in (no addon cost for speaker labels)
- Entity detection (names, dates, amounts extracted automatically)
- 30% fewer hallucinations than Whisper Large-v3
- SOC 2 Type II compliant — audio never stored after processing

**Pricing**: $0.21/hr batch (Universal-3 Pro), $0.45/hr streaming (u3-rt-pro). Competitive with Deepgram ($0.25/hr), cheaper than Google Cloud STT ($0.96/hr).

**Switchability**: The `speech_models` parameter is user-configurable. We can add Deepgram or Whisper as alternative providers without architectural changes.

**Sources**: [AssemblyAI Benchmarks](https://www.assemblyai.com/benchmarks), [STT API Comparison](https://www.assemblyai.com/blog/speech-to-text-api-pricing)

#### LLM Summarization: Vercel AI SDK v6 + AI Gateway

**Decision**: Use the Vercel AI SDK with AI Gateway for LLM routing.

**Justification**:
- **AI Gateway**: Single API key routes to any model (Anthropic, OpenAI, Google) without managing separate provider keys
- **Model flexibility**: Users pick their model in settings — cheapest (GPT-5.4 Nano at $0.20/1M tokens) or best (Claude Opus 4.7 at $5/1M tokens)
- **`generateObject`**: Structured output with Zod schemas — LLM returns typed JSON, not free-form text. Guarantees the summary, intake form, and action items match our schema every time.
- **Streaming**: `streamText` for chat, `streamObject` for real-time structured output
- **Telemetry**: Built-in OpenTelemetry integration traces every LLM call to Langfuse
- **Cost tracking**: Token counts per call, cached input pricing, per-meeting cost breakdown

**Alternatives considered**:
- **Direct provider SDKs**: Would need 3+ API keys, 3+ billing relationships, no unified observability
- **LangChain**: Heavy abstraction layer, slower, more complex than AI SDK's lightweight approach
- **Custom prompt + fetch**: No structured output guarantees, no streaming, no telemetry

**Why AI Gateway over direct API calls**: Zero data retention by default. No markup on provider pricing. Unified billing. Model switching without code changes.

#### Database: Supabase (PostgreSQL + Auth)

**Decision**: Use Supabase for data persistence, authentication, and real-time capabilities.

**Justification**:
- PostgreSQL with Row Level Security — each user can only see their own meetings
- Built-in auth: anonymous sign-in (zero-friction onboarding), email magic link, Google OAuth
- Edge Functions for webhooks (Stripe)
- Free tier generous enough for development; Pro plan ($25/mo) for production
- pgvector extension available for future semantic search across transcripts

#### Billing: Stripe

**Decision**: Stripe for subscription billing.

**Justification**: Industry standard. Checkout Sessions handle the payment flow. Webhooks sync subscription state to our `profiles` table. Test mode keys for development, live keys for production.

#### Observability: Langfuse

**Decision**: Langfuse for LLM observability.

**Justification**: Open-source, self-hostable, free tier (50k observations/month). Traces every AI SDK call automatically via OpenTelemetry. Shows cost per call, latency, token counts, prompt/response pairs. Critical for debugging summary quality and cost optimization.

#### Email: Resend

**Decision**: Resend for transactional email.

**Justification**: Developer-friendly API, React Email templates, Supabase SMTP integration. Free tier (100 emails/day) sufficient for launch. Custom domain support for branded emails.

---

## 4. Product Architecture

### User Flow

```
Open app → One-tap "Start Recording" → Live transcript appears
    → Stop recording → AI generates summary + intake form
    → Meeting saved → Export (PDF/MD) or share via link
```

### Data Flow

```
Mic/System Audio → AssemblyAI (real-time or batch)
    → Transcript + Speaker Labels → LLM (via AI Gateway)
    → Structured Summary + Intake Form → Supabase (persist)
    → UI renders → Export / Share / Chat with transcript
```

### Pricing Model

| Tier | Price | Limits | Target |
|---|---|---|---|
| **Free** | $0 | 25 lifetime meetings | Trial users |
| **Core** | $15/mo | 600 min/month, 8 speakers | Solo professionals |
| **Pro** | $25/mo | Unlimited (1,500 fair-use), unlimited speakers | Power users, teams |

**Unit economics** (per meeting, 30 min average):
- STT cost: ~$0.10 (batch) or ~$0.22 (streaming)
- LLM cost: ~$0.003 (GPT-5.4 Nano) to ~$0.15 (Claude Opus 4.7)
- **Total cost per meeting**: $0.10 - $0.37
- **At Core tier ($15/mo)**: ~40 meetings/mo = $4-15 cost = $0-11 margin
- **At Pro tier ($25/mo)**: ~100 meetings/mo = $10-37 cost = negative to $15 margin

Cost is manageable because:
1. Most users use the cheapest LLM (GPT-5.4 Nano)
2. Batch transcription is 2x cheaper than streaming
3. Prompt caching reduces LLM input costs by up to 90%
4. Users self-select: heavy users upgrade, light users stay on free

---

## 5. Platform Strategy

### Phase 1: Web + macOS (Current)
- Web app deployed to Vercel (production-ready)
- macOS desktop via Tauri (system audio capture, menu bar mode)
- iOS via Capacitor (WebView wrapping deployed app)

### Phase 2: Full Mobile
- iOS native mic recording in Capacitor shell
- Background recording support
- Push notifications for meeting-ready summaries
- Android via Capacitor (same codebase)

### Phase 3: Desktop Intelligence
- Auto-detect meetings (watch for Zoom/Meet/Teams process + mic)
- Notification: "Meeting detected — start recording?"
- System audio loopback capture (bot-free)
- Menu bar persistent mode

### Phase 4: Ecosystem
- Meeting detail chat (query transcripts with AI)
- Cross-meeting search (semantic search via pgvector)
- Shared workspaces (team collaboration)
- CRM integration (push structured data to HubSpot/Salesforce)
- Calendar integration (auto-prepare for upcoming meetings)

---

## 6. Technical Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AssemblyAI price increase | Medium | High | Architecture allows swapping to Deepgram/Whisper via settings |
| iOS call recording restrictions | High | Medium | Use device mic capture (Granola approach), not system API |
| Tauri/ScreenCaptureKit API changes | Low | High | Pin crate versions, test on each macOS release |
| LLM summary quality inconsistency | Medium | Medium | Zod schema validation, multiple model options, eval harness |
| Supabase free tier limits | Low | Low | Upgrade path clear, $25/mo Pro plan covers production |
| WebView performance on mobile | Medium | Medium | Optimize bundle size, lazy load routes, use production build |

---

## 7. Success Metrics

### Launch (30 days)
- [ ] 100 meetings transcribed end-to-end
- [ ] 10 users completing the free tier flow
- [ ] <5s time-to-first-word on live transcription
- [ ] <$0.20 average cost per meeting

### Growth (90 days)
- [ ] 1,000 meetings transcribed
- [ ] 5% free → paid conversion rate
- [ ] <2% error rate on transcription pipeline
- [ ] Net Promoter Score > 40

### Scale (6 months)
- [ ] 10,000 meetings/month
- [ ] 100 paying subscribers
- [ ] $1,500 MRR
- [ ] Multi-platform active users (web + desktop + mobile)

---

## 8. Build vs Buy Decisions

| Component | Decision | Rationale |
|---|---|---|
| Transcription | **Buy** (AssemblyAI) | Building STT is a multi-year, multi-million dollar effort. AssemblyAI is best-in-class. |
| LLM | **Buy** (via AI Gateway) | No competitive advantage in running our own models. Gateway gives model flexibility. |
| Auth | **Buy** (Supabase Auth) | Solved problem. Anonymous + email + OAuth out of the box. |
| Database | **Buy** (Supabase Postgres) | Managed Postgres with RLS. No ops overhead. |
| Billing | **Buy** (Stripe) | Industry standard. Checkout + webhooks in hours, not weeks. |
| Desktop shell | **Build** (Tauri) | Unique requirement: system audio capture. No off-the-shelf solution. |
| Mobile shell | **Buy** (Capacitor) | Wraps existing web app. Native API access via plugins. |
| Summary/Intake extraction | **Build** | Our core differentiator. Zod schemas + structured prompts = competitive moat. |
| UI | **Build** | Custom design system. No component library matches our needs. |

---

## 9. Timeline

| Week | Milestone |
|---|---|
| Week 1-2 | Core pipeline: transcription + summary + persistence |
| Week 3 | Billing (Stripe), auth (Supabase), settings (model selection) |
| Week 4 | Desktop shell (Tauri), mobile shell (Capacitor), platform fixes |
| Week 5 | UI redesign, email system (Resend), docs |
| Week 6 | Meeting detail chat, search, shared workspaces |
| Week 7 | Desktop intelligence (auto-detect meetings, menu bar) |
| Week 8 | Polish, performance, beta launch |

**Current status**: Week 5 (UI redesign in progress)

---

## 10. Open Questions

1. **Custom domain**: Should we move to `layerone.ai` or similar? Currently on `audio-layer.vercel.app`.
2. **Pricing validation**: Are $15/$25 price points right? Granola is $14, Otter is $17, Fireflies is $19.
3. **Audio storage**: Current policy is never-store. Should we offer optional audio playback as a premium feature?
4. **Team workspaces**: When? Spec is written (`WORKSPACES_SPEC.md`) but adds significant complexity.
5. **Windows**: Tauri supports Windows via WASAPI loopback. When do we prioritize it?

---

## Appendix: Technical References

- [AssemblyAI Benchmarks](https://www.assemblyai.com/benchmarks)
- [Tauri vs Electron 2026](https://www.pkgpulse.com/blog/tauri-vs-electron-2026)
- [Vercel AI SDK Documentation](https://ai-sdk.dev)
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [AI Meeting Assistants Market](https://www.precedenceresearch.com/ai-in-meeting-assistants-market)
- [AI Note-Taking Market](https://www.precedenceresearch.com/ai-note-taking-market)
