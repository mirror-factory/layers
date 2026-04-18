# MFDR-001: Layer One — Product Architecture & Technology Stack

**Status:** Accepted
**Date:** 2026-04-18
**Owner:** Alfonso Morales
**Phase:** Production

---

## Context

Mirror Factory is building Layer One, a meeting transcription and context extraction tool. The market for AI meeting assistants is $1.42B (2026) growing to $6.28B by 2035 at 18% CAGR (Precedence Research). Existing solutions either require a visible bot to join meetings (Otter, Fireflies) or are single-platform (Granola, Mac-only). We need to ship a multi-platform product (web, macOS, iOS) from a small team, using the highest-accuracy transcription available, with structured data extraction that goes beyond basic summaries.

This MFDR documents the foundational decisions that shape the entire product: why these technologies, why this architecture, and why this approach to the market.

---

## Decision Drivers

- **Speed to market:** Small team needs to ship web + desktop + mobile without 3x the codebase. Affects our ability to validate product-market fit before competitors consolidate.
- **Transcription quality:** Users will not tolerate inaccurate transcriptions. The product is worthless if the words are wrong. This is table stakes, not a differentiator.
- **Structured extraction as moat:** Our competitive advantage is not transcription — it's turning conversations into actionable structured data (budgets, timelines, decision makers, requirements). This requires reliable LLM structured output.
- **Bot-free capture:** Participants change behavior when they know they're being recorded by a bot. System-level audio capture (no bot in the meeting) is essential for natural conversation capture.
- **Cost predictability:** Per-meeting costs must be low enough to sustain a $15-25/mo subscription model with positive unit economics.

---

## Options Considered

### Option A: Electron + React Native + Google Cloud STT

**Description:** Electron for desktop, React Native for mobile, Google Cloud Speech-to-Text for transcription, custom backend (Express/FastAPI).

**Pros:**
- Electron has the largest ecosystem and most documentation
- React Native has a massive hiring pool
- Google STT is well-documented

**Cons:**
- Electron bundles 80-200MB per app (Chromium + Node.js)
- Electron idles at 200-300MB RAM — unacceptable for a background recording tool
- React Native requires a separate UI layer from the web app — doubles frontend work
- Google Cloud STT costs $0.96/hr — 4.5x more expensive than AssemblyAI
- No system audio capture in Electron without third-party audio drivers (Soundflower/BlackHole)
- Three separate codebases: web (React), desktop (Electron), mobile (React Native)

**Effort:** High (3 codebases, 3 deployment pipelines)

---

### Option B: Next.js + Tauri + Capacitor + AssemblyAI + Vercel AI SDK (Chosen)

**Description:** Single Next.js web app deployed to Vercel. Tauri wraps it for desktop (Rust backend enables system audio via ScreenCaptureKit). Capacitor wraps it for mobile (WebView loads the deployed app). AssemblyAI for transcription. Vercel AI SDK + AI Gateway for LLM routing.

**Pros:**
- One codebase serves all three platforms
- Tauri: 2-10MB bundles (25x smaller than Electron), 30-40MB RAM (75% less), <0.5s startup (4x faster)
- Tauri + ScreenCaptureKit = native macOS system audio capture (bot-free, same as Granola)
- Capacitor loads the live Vercel deployment — updates ship instantly without App Store review
- AssemblyAI: 8.1% WER (best-in-class accuracy), $0.21/hr batch / $0.45/hr streaming
- AI Gateway: single API key routes to any LLM provider, zero markup, user picks their model
- Vercel AI SDK `generateObject`: Zod-validated structured output — guarantees schema compliance
- Built-in observability: Langfuse traces every LLM call automatically

**Cons:**
- Tauri requires Rust knowledge (learning curve for team)
- Rust compilation is slow during development (~3-5 min first build)
- Capacitor WebView performance is lower than native on mobile
- AssemblyAI is a single vendor dependency for the critical transcription pipeline

**Effort:** Medium (1 codebase, but platform-specific native code for audio capture)

---

### Option C: Flutter + Deepgram + Custom Backend

**Description:** Flutter for all platforms (web, desktop, mobile), Deepgram for transcription, custom Python/Go backend.

**Pros:**
- Flutter's single codebase produces native binaries for all platforms
- Deepgram has excellent real-time streaming performance
- Full control over backend architecture

**Cons:**
- Dart is a niche language — limited hiring pool
- Flutter web performance is poor compared to React/Next.js
- No code sharing with existing Mirror Factory web projects (all React/Next.js)
- Separate backend service adds operational complexity (hosting, monitoring, deploys)
- No equivalent to AI Gateway — would need to manage multiple LLM provider integrations
- System audio capture on macOS requires FFI to native APIs from Dart — fragile

**Effort:** High (new language, new framework, separate backend)

---

## Decision

**We will:** Build on Next.js + Tauri + Capacitor + AssemblyAI + Vercel AI SDK with AI Gateway.

**Because:** This is the only architecture that gives us:
1. **One codebase, three platforms** — Next.js serves web, Tauri wraps it for desktop, Capacitor wraps it for mobile
2. **Bot-free system audio capture** — Tauri's Rust backend can call ScreenCaptureKit directly, which is impossible in Electron without kernel extensions
3. **Best-in-class transcription at the lowest cost** — AssemblyAI's 8.1% WER at $0.21/hr beats Google ($0.96/hr) and matches Deepgram's accuracy
4. **Structured output guarantees** — Vercel AI SDK's `generateObject` with Zod schemas ensures every summary and intake form matches our data model
5. **Model flexibility** — AI Gateway lets users switch LLM providers without code changes, and we pay zero markup
6. **Instant mobile updates** — Capacitor loads from the Vercel deployment URL, so code changes ship immediately

The main trade-off is Rust compilation time and Capacitor's WebView performance on mobile. Both are acceptable: compilation only affects developers (not users), and WebView performance is adequate for a text-heavy app.

---

## Consequences

### What this enables:
- Ship to web, macOS, and iOS from a 1-2 person team
- System-level audio capture without a meeting bot
- User-selectable LLM with transparent per-meeting cost
- Structured data extraction (not just summaries) as our competitive moat
- Future Android and Windows support without new codebases (Capacitor + Tauri both support them)

### What this limits or defers:
- No pixel-perfect native mobile UI — Capacitor WebView can feel slightly less fluid than Swift/Kotlin
- Rust learning curve for future contributors
- Vendor dependency on AssemblyAI for the core transcription pipeline
- Vendor dependency on Vercel for hosting and AI Gateway

### What we'll need to watch:
- AssemblyAI pricing changes — we should maintain the ability to swap providers
- Capacitor WebView performance on older iOS devices — may need to optimize bundle size
- Tauri ScreenCaptureKit compatibility with future macOS versions
- AI Gateway credit consumption — monitor and set spend limits

---

## Connection to Direction

**Mission alignment:** Layer One enables human agency by capturing conversational context that would otherwise be lost. People can focus on the conversation instead of note-taking, and the AI extracts the structured information they need to take action.

**KPI impact:**
- Time saved per meeting (target: 15 min of post-meeting note consolidation eliminated)
- Action item capture rate (target: 90%+ of spoken commitments extracted)
- User activation (target: first meeting transcribed within 60 seconds of account creation)

**Phase transition:** This decision moves us from Concept to Production. The architecture is proven (v0.1.52 deployed), and the focus shifts to UI polish, feature completeness, and user acquisition.

---

## Follow-up

- [ ] Validate mobile WebView performance with 10 real users on iPhone SE (lowest-spec target)
- [ ] Set up AssemblyAI spend alerts at $50 and $100 thresholds
- [ ] Implement Deepgram as alternative STT provider (settings toggle) to reduce vendor risk
- [ ] Load test: 100 concurrent streaming sessions to validate Vercel serverless scaling
- [ ] Run A/B test on LLM model default: GPT-5.4 Nano vs Gemini 3.1 Flash Lite for summary quality

---

*Mirror Factory Decision Record • Layer One v1.0*
