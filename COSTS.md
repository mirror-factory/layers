# Cost model

How much this thing costs to run. Based on the pricing tables wired into `lib/billing/llm-pricing.ts` and `lib/billing/assemblyai-pricing.ts` — review quarterly against published rates.

## Per-meeting math

Standard config: batch transcription, `speech_model = best` (Universal-3 Pro), speaker diarization + entity detection enabled, Claude Sonnet 4.6 for summary + intake.

| Component | Rate | 30-min meeting | 60-min meeting |
|---|---|---|---|
| AssemblyAI base (U-3 Pro batch) | $0.21/hr | $0.105 | $0.210 |
| + speaker diarization add-on | $0.02/hr | $0.010 | $0.020 |
| + entity detection add-on | $0.08/hr | $0.040 | $0.080 |
| **AssemblyAI subtotal** | — | **$0.155** | **$0.310** |
| Claude Sonnet 4.6 — summary (~12k in / 800 out) | $3 / $15 per 1M tok | $0.048 | $0.084 |
| Claude Sonnet 4.6 — intake (~12k in / 500 out) | $3 / $15 per 1M tok | $0.044 | $0.077 |
| **LLM subtotal** | — | **$0.092** | **$0.161** |
| **Total** | — | **$0.247** | **$0.471** |

Streaming (`u3-rt-pro`) is **more expensive**: $0.45/hr base + $0.02/hr diarization = $0.47/hr of audio. On a 60-min session that's $0.47 for STT alone, roughly 1.5× the batch cost. Use streaming for the live-captions UX; fall back to batch when the user uploads a file post-call.

## Per-user at typical usage

Assuming batch meetings (most common) with the standard config above:

| User profile | Meetings/month | Avg duration | Monthly cost (STT+LLM) |
|---|---|---|---|
| Tire-kicker | 2 | 30 min | **$0.49** |
| Light user | 6 | 30 min | **$1.48** |
| Normal user | 12 | 45 min | **$4.45** |
| Power user | 30 | 60 min | **$14.13** |
| Heavy user | 60 | 60 min | **$28.26** |

The pricing brief (Core $15, Pro $25) is designed against these numbers. Core covers "normal" users with comfortable margin; Pro covers power users at break-even to moderate margin. Heavy users on Pro lose money — the 1,500-minute fair-use soft cap in the brief exists specifically to bound this.

## At scale

Back-of-envelope for 1,000 paying users at the Core tier:

| Bucket | Users | Avg meetings/mo | Cost/user | Cost subtotal |
|---|---|---|---|---|
| Tire-kicker | 150 | 2 | $0.49 | $74 |
| Light | 400 | 6 | $1.48 | $592 |
| Normal | 300 | 12 | $4.45 | $1,335 |
| Power | 100 | 30 | $14.13 | $1,413 |
| Heavy | 50 | 60 | $28.26 | $1,413 |
| **Total variable cost** | 1,000 | — | — | **$4,827/mo** |

Revenue at Core $15 × 1,000 = $15,000/mo → gross margin ~68% before fixed infra (Vercel, Supabase, Langfuse, Stripe fees). That's healthy by SaaS standards; brief targets 60–70% so we're on track.

## Fixed infra

| Service | Plan needed | Cost |
|---|---|---|
| Vercel | Pro | $20/mo base + usage |
| Supabase | Pro (for 8 GB DB + cron + point-in-time recovery) | $25/mo |
| Langfuse Cloud | Hobby (free) until ~50k observations/mo; then Pro | $0 → $49/mo |
| Stripe | No fixed fee; 2.9% + 30¢ per transaction | $0 |
| Domain + email | — | ~$20/yr |

**Rough fixed baseline: ~$70/mo**. Doesn't move meaningfully with user count until Langfuse hits its free-tier cap (each meeting generates ~3–4 observations = summary call + intake call + chat if used).

## Where the money goes

From the cost math above, at the "normal" user profile (12× 45-min meetings):

```
  STT base (U-3 Pro)                 47%  ■■■■■■■■■■■■■■
  LLM (summary + intake)             35%  ■■■■■■■■■■
  STT entity-detection add-on        12%  ■■■
  STT diarization add-on              3%  ■
  Infra per-user (allocated fixed)    3%  ■
```

STT dominates. If this ever becomes a concern:
- **Cheaper model tier** — `nano` at $0.15/hr is 30% cheaper than `best`; accuracy drops ~3 pts WER.
- **Skip entity detection** — saves 25% on STT, costs us the intake's "named entities" signal.
- **Self-hosted Whisper** — approximates zero marginal cost but requires GPU infra; breaks even only at huge scale.

Not recommending any of these right now. `best` with full add-ons is the right default while we prove product-market fit.

## Cost regressions to watch

Each of these would blow up the unit economics:

- **LLM prompt bloat**: if the summary prompt grows past ~20k tokens of transcript, cost per meeting spikes. Currently capped implicitly by user recording length. Add a token-count guard in `summarizeMeeting()` if meetings start exceeding 2 hrs.
- **Cached-input underuse**: Claude Sonnet cached-input is 10% of fresh-input. We're NOT using cache-aware prompting today — the summary/intake pair could share a system prompt + transcript prefix for a cache hit. Potential 40–60% LLM cost reduction; tracked as a future optimization.
- **Model drift**: price table in `lib/billing/llm-pricing.ts` is hardcoded. When Anthropic bumps prices, we underestimate until someone updates the table. Review quarterly; consider a nightly CI check that diffs against a known-rate API if one becomes available.
- **AssemblyAI rate changes**: same problem, see `lib/billing/assemblyai-pricing.ts`.

## Displayed cost vs. actual cost

Three sources of truth:

1. **`meetings.cost_breakdown`** (per-meeting, stored on completion). Computed from our pricing tables × actual tokens/seconds. This is what users see on `/meetings/[id]` and what aggregates into `/usage`.
2. **Langfuse** — auto-computes cost from token counts × Langfuse's own pricing data (they maintain their own price tables for predefined models). When configured and reporting traces, `/usage` overlays this over our local numbers.
3. **Vercel AI Gateway dashboard** — authoritative for LLM spend. No public API — dashboard-only. Reconcile monthly against our displayed numbers; diffs will point at pricing-table drift.

The three should stay within 1–2% of each other. Larger divergence means a price table is stale.
