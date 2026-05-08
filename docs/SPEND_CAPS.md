# Spend Caps

Tracks: [PROD-396](https://linear.app/mirror-factory/issue/PROD-396)

> Companion docs: [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md), [RELEASE.md](./RELEASE.md)

## Why this exists

Layers is going to its first 10 alpha users on a paid SaaS. A leaked key, runaway loop, or single high-volume tester can drain the runway in a weekend if every external vendor is uncapped. This document is the operational ceiling: every vendor we pay or could pay has a hard cap, an alert path, and a written kill-switch.

**Default alert mailbox:** `support@mirrorfactory.ai`
**Default owner (until further notice):** founder (Alfonso)
**Currency:** USD
**Cycle:** monthly billing cycle unless noted

The caps below are **opinionated starting values for a 10-user alpha**. Tweak after one billing cycle of real data.

---

## TL;DR — Cap matrix

| Vendor | Cap (USD/mo) | Alert | Kill-switch (where) |
| --- | ---: | --- | --- |
| Vercel (hosting) | $20 | 50/75/100% via web+email | Pause all projects (auto, opt-in) |
| Vercel AI Gateway prepaid balance | $200 | `/observability/burn` + Langfuse/support alerts | Disable auto top-up; rotate `AI_GATEWAY_API_KEY` |
| AI Gateway provider budgets | $120 Anthropic / $40 OpenAI / $40 Google (inside $200) | daily provider burn at 50/80/100% monthly run-rate | Route provider off in model router |
| Supabase org cap | $25 | Cost Control + email | Spend Cap auto-disables overage usage |
| Supabase storage sub-limit | $10 (inside Supabase cap) | storage usage alert at 50/80/100% | Disable uploads; shorten signed URLs |
| Supabase egress sub-limit | $15 (inside Supabase cap) | egress usage alert at 50/80/100% | Block downloads; revoke public URLs |
| Anthropic direct | $50 | 50/80/100% email | Rotate `ANTHROPIC_API_KEY` |
| OpenAI direct | $50 | 50/80/100% email | Rotate `OPENAI_API_KEY` (if used) |
| Google AI / Vertex | $50 | Cloud Billing budget + pubsub | Disable billing on project; rotate keys |
| AssemblyAI | $50 | dashboard threshold + email | Rotate `ASSEMBLYAI_API_KEY` |
| Deepgram | $30 | console threshold + email | Rotate `DEEPGRAM_API_KEY` |
| Stripe | n/a (revenue) | Radar alerts | Pause new subscriptions |
| Inngest | $0 (free tier) | tier-cap | Pause functions in dashboard |
| Resend | $0 (free 3k/mo) | tier-cap | Disable API key |

**Total worst-case external monthly burn cap (alpha): ~$425/mo.** Supabase storage/egress and AI Gateway provider rows are sub-budgets inside the parent caps, so they do not add additional exposure.

---

## Per-vendor configuration

Each vendor below uses the same five-field structure: cap value, alerts, owner, configuration steps, kill-switch.

### 1. Vercel (hosting, edge functions, bandwidth)

- **Cap value:** $20/mo (Pro plan included usage covers most alpha traffic; this catches metered overage only).
- **Alert thresholds:** 50% / 75% / 100% web + email to `support@mirrorfactory.ai`. (Vercel's own thresholds are 50/75/100; close enough to the 50/80/100 standard.) SMS at 100% optional.
- **Owner:** founder.
- **Configuration steps** (verified against `vercel.com/docs/spend-management`, last fetched 2026-05-01):
  1. Vercel team dashboard → **Settings** → **Billing**.
  2. Scroll to **Spend Management** → toggle **Enabled**.
  3. Set spend amount = `$20`.
  4. Enable **Pause production deployment** when threshold hit (read warning: pause is not instantaneous, can lag several minutes).
  5. Settings → **My Notifications** → ensure **Spend Management** web + email are on at 50/75/100%.
  6. Optional: configure a webhook URL for Slack/PagerDuty notifications.
- **Kill-switch:** Spend Management auto-pauses production deployments when the cap trips. To restart cleanly: Settings → Projects → resume each project individually after raising the cap or the billing cycle resets. To stop the bleeding faster, manually pause projects via Project → Settings → "Pause Project" — visitors will see `503 DEPLOYMENT_PAUSED`.

### 2. Supabase (Postgres, auth, storage, egress)

- **Cap value:** $25/mo overage above Pro plan's included allocation. Internal sub-limits: storage `$10/mo`, egress `$15/mo`.
- **Alert thresholds:** Email at threshold; configure a Cost Control alert in dashboard. There is no native 50/80/100% staircase for every resource, so the release checklist requires separate storage and egress checks at 50/80/100% of their sub-limits and an explicit 80% cutoff playbook.
- **Owner:** founder.
- **Configuration steps** (verified against `supabase.com/docs/guides/platform/spend-cap`, last fetched 2026-05-01):
  1. Supabase dashboard → **Organization** → **Billing** (`/dashboard/org/<org>/billing`).
  2. Find **Cost Control** section → **Spend Cap** → toggle **Enabled**.
  3. Confirm what is capped (Disk, Egress, Edge Function invocations, MAU, Realtime, Storage transformations & size). Compute, Custom Domain, IPv4, Log Drains, PITR, advanced MFA are **NOT capped** — these are billed regardless.
  4. Enable email notifications under **Notifications** for billing events.
  5. Storage sub-limit: Billing → Usage → Storage. Record current month storage usage; if a native alert exists in the dashboard, set thresholds at `$5`, `$8`, and `$10`. If the dashboard only supports one threshold, set `$8` and use `/observability/burn` for the 50/100% release check.
  6. Egress sub-limit: Billing → Usage → Egress. Record current month egress usage; if a native alert exists, set `$7.50`, `$12`, and `$15`. If the dashboard only supports one threshold, set `$12` and use `/observability/burn` for the 50/100% release check.
- **Kill-switch:** When Spend Cap engages, additional usage of capped items is blocked until the next billing cycle. **This means the project goes read-only / fails on the capped resource — treat as P1 outage.** To force-stop sooner: pause the project via Settings → General → **Pause project**. To revive a paused project: same path → **Restore**.
- **Storage kill-switch:** Disable upload routes, rotate signed URL secrets if exposed, shorten signed URL TTLs, and delete orphaned audio after incident review.
- **Egress kill-switch:** Disable audio downloads, revoke public/signed URLs, rotate the anon key if abuse is key-driven, and add a route-level rate limit before re-enabling.

### 3. Vercel AI Gateway (primary LLM path — Anthropic/OpenAI/Google)

- **Cap value:** $200/mo via prepaid credits. AI Gateway has no native "hard cap" — instead, **disable auto top-up** and only buy credits in increments of $200/mo. When credits hit zero, requests fail.
- **Provider sub-budgets:** Anthropic `$120/mo`, OpenAI `$40/mo`, Google `$40/mo`, all inside the `$200` prepaid parent budget.
- **Alert thresholds:** Manual — there is no native 50/80/100% alert. Instead:
  - `/observability/burn` reads today's AI call costs from the shared AI log store, splits them into Anthropic/OpenAI/Google provider rows, computes 30-day run-rate, and sorts rows by `% of cap`.
  - Alert via Langfuse/support when total Gateway balance/run-rate crosses `$100` (50%), `$160` (80%), and `$200` (100%).
  - Alert via Langfuse/support when provider run-rate crosses 50/80/100% of its provider sub-budget.
  - Budget review every Monday: read balance from `vercel.com/<team>/~/ai-gateway`.
- **Owner:** founder.
- **Configuration steps** (verified against `vercel.com/docs/ai-gateway/pricing`, last fetched 2026-05-01):
  1. Vercel dashboard → sidebar → **AI Gateway**.
  2. Top-right corner → click balance → **Top up** with $200.
  3. Click **Change** next to **Auto top-up** → **disable** (default is disabled — confirm).
  4. Implement balance polling: cron `GET /v1/balance` (see `/docs/ai-gateway/capabilities/usage`), threshold alert into `support@mirrorfactory.ai`.
  5. Provider budgets are operational budgets, not native Gateway hard caps as of 2026-05-01. Track them in Langfuse and `/observability/burn` using rows from `lib/ops/spend-caps.ts`.
  6. If a provider misbehaves, switch the model in `lib/ai/model-router.ts` / `lib/model-router.ts` away from that provider and redeploy.
- **Kill-switch (in this order):**
  1. Set `AI_GATEWAY_API_KEY` to invalid value in Vercel → Project Settings → Environment Variables → Production. Redeploy.
  2. Or revoke the key entirely: Vercel team → AI Gateway → **API Keys** → delete.
  3. Or simply do nothing once balance hits zero — requests fail cleanly with 402.
  4. Provider-only cutoff: reroute Anthropic/OpenAI/Google models off in the model router; leave Gateway active only for the remaining providers.
- **Linear remediation ticket:** _follow-up TBD_ — file when AI Gateway ships per-provider sub-budgets.

### 4. Anthropic direct API

- **Cap value:** $50/mo (only used as fallback if AI Gateway is down).
- **Alert thresholds:** 50% / 80% / 100% via Anthropic console email alerts.
- **Owner:** founder.
- **Configuration steps:**
  1. Anthropic Console → **Settings** → **Plans & Billing** → **Usage Limits**.
  2. Set monthly limit = `$50`.
  3. Set monthly soft alerts at 50/80%; hard cap at 100%.
- **Kill-switch:** Console → **API Keys** → revoke `ANTHROPIC_API_KEY`. Update Vercel env var to a placeholder; redeploy. Code paths: `lib/ai/model-router.ts` and `lib/model-router.ts` should stay gateway-first.

### 5. OpenAI direct API (only if used outside the gateway)

- **Cap value:** $50/mo.
- **Alert thresholds:** 50/80/100% via OpenAI usage alerts.
- **Owner:** founder.
- **Configuration steps:**
  1. OpenAI Platform → **Settings** → **Billing** → **Usage limits**.
  2. Set **Hard limit** = `$50`. Set **Soft limit** = `$25`.
  3. Configure email alerts under **Notifications**.
- **Kill-switch:** Platform → **API Keys** → revoke `OPENAI_API_KEY`. Repo currently has no direct OpenAI usage; if added, gate behind `OPENAI_API_KEY` env presence so revocation is sufficient.

### 6. Google AI / Vertex AI

- **Cap value:** $50/mo.
- **Alert thresholds:** Cloud Billing budget at 50/80/100% with Pub/Sub topic for hard-cutoff automation.
- **Owner:** founder.
- **Configuration steps:**
  1. Google Cloud Console → **Billing** → select billing account → **Budgets & alerts**.
  2. Click **Create Budget**, scope to the Vertex/Generative AI project, amount = `$50`.
  3. Add thresholds: 50%, 80%, 100% (current spend) + 100% (forecasted).
  4. Connect a Pub/Sub topic for programmatic cutoff (see PROD-397 remediation: a Cloud Function that disables billing on the project when the topic receives a 100% event).
  5. APIs & Services → enable only the APIs we need (Generative Language API, Calendar API). Disable everything else.
- **Kill-switch:** Console → **Billing** → **Manage billing** → **Disable billing on this project**. This cuts off OAuth, Calendar, AI calls in one move. Re-enable after incident review. **PROD-397** tracks the long-term automation (Pub/Sub → Cloud Function → disable-billing).

### 7. AssemblyAI (batch + streaming transcription, primary STT)

- **Cap value:** $50/mo — the alpha is 10 users at maybe 5 hrs/wk each = 200 hrs/mo. AssemblyAI Universal pricing is ~$0.12/hr for batch and ~$0.15/hr for streaming, so 200 hrs maps to ~$24–$30. Cap headroom = $50.
- **Alert thresholds:** Email at 50/80/100% — set in dashboard.
- **Owner:** founder.
- **Configuration steps:**
  1. AssemblyAI Dashboard → **Account** → **Spend Limits** (verify exact label; UI changes — check at `assemblyai.com/app/account` after login).
  2. Set monthly cap = `$50`.
  3. Enable email alerts at 50/80/100%.
- **Kill-switch:** Dashboard → **API Keys** → rotate. Update `ASSEMBLYAI_API_KEY` in Vercel env (Production + Preview), redeploy. Code falls back to Deepgram if `lib/recording/transcription-provider.ts` runtime provider switch is set.

### 8. Deepgram (alt streaming transcription)

- **Cap value:** $30/mo (only used as fallback or A/B test).
- **Alert thresholds:** Console alerts at 50/80/100%.
- **Owner:** founder.
- **Configuration steps:**
  1. Deepgram Console → **Settings** → **Billing** → **Spend Limits** (verify exact label in console).
  2. Set monthly cap = `$30`.
  3. Enable email alerts to `support@mirrorfactory.ai`.
- **Kill-switch:** Console → **API Keys** → rotate. Set `DEEPGRAM_API_KEY` to empty in Vercel env; runtime provider switches back to AssemblyAI.

### 9. Stripe (billing customer)

- **Cap value:** N/A — Stripe is the revenue side, not a cost center. Fees are 2.9% + $0.30 per transaction.
- **Alert thresholds:** Radar fraud rules; email on chargeback; email on failed-webhook spike.
- **Owner:** founder.
- **Configuration steps:**
  1. Stripe Dashboard → **Radar** → **Rules** → enable starter ruleset.
  2. Add custom rule: `Block if :card_country: != :ip_country: and amount > $20` (sanity rule for $20 Core / $30 Pro tier).
  3. Set **Notifications** → email on dispute, failed webhook signature, refund spike.
  4. Webhook endpoints per tier (already in RELEASE.md).
- **Kill-switch:** Dashboard → **Settings** → **Billing** → **Subscriptions** → **Pause new subscriptions**. Existing subs continue; no new charges. To stop everything: rotate `STRIPE_SECRET_KEY`, redeploy. **Don't do this casually** — it stops billing reconciliation entirely.

### 10. Inngest (background jobs)

- **Cap value:** $0 (free tier hard ceiling: ~50K runs/mo, 25 step concurrency). Stay free until product proves it.
- **Alert thresholds:** Free-tier exhaustion email; configure additional alerts at 80% via dashboard once we cross 30K runs/mo.
- **Owner:** founder.
- **Configuration steps:**
  1. Inngest dashboard → **Settings** → **Billing** → confirm plan = Free.
  2. If/when we upgrade: set **Spend limit** = `$50/mo`.
  3. Enable email notifications on usage approaching free-tier ceiling.
- **Kill-switch:** Inngest dashboard → **Functions** → **Pause** each function. Or rotate `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` (env vars not yet present in repo — add when wiring Inngest, see future PROD-XXX).

### 11. Resend (transactional email)

- **Cap value:** $0 (free 3K emails/mo). Onboarding 10 alpha users uses negligible volume.
- **Alert thresholds:** Free-tier exhaustion; 80% dashboard alert.
- **Owner:** founder.
- **Configuration steps:**
  1. Resend dashboard → **Settings** → **Usage & Billing**.
  2. Confirm plan = Free.
  3. Enable email alerts to `support@mirrorfactory.ai` at 80% of free quota.
  4. When upgrading to paid: Settings → Billing → set hard monthly cap.
- **Kill-switch:** Dashboard → **API Keys** → rotate. Set `RESEND_API_KEY` to empty in Vercel env; redeploy. Onboarding emails fail closed (user can still sign in via Supabase magic link, which uses Supabase SMTP).

---

## Burn-rate dashboard

Internal dashboard path: `/observability/burn`.

The Burn page is the internal source of truth for the daily vendor burn table. It reads the shared registry in `lib/ops/spend-caps.ts`, uses the same AI telemetry backend as `/api/ai-logs` for live AI Gateway and per-provider AI spend, projects the vendor rows that do not expose an API yet, computes `daily burn x 30 / monthly cap`, and sorts rows by `% of cap` descending.

| Row | Daily burn source | Alpha projected daily burn | Monthly cap | Alert channel | Kill-switch |
| --- | --- | --: | --: | --- | --- |
| AssemblyAI | Vendor dashboard projection until spend API is wired | $0.40 | $50 | dashboard email at 50/80/100% | rotate `ASSEMBLYAI_API_KEY` |
| AI Gateway - Anthropic | live `/api/ai-logs` split by provider | $0.35 | $120 | Langfuse/support at 50/80/100% | route Claude off |
| Vercel AI Gateway total | live `/api/ai-logs` total cost | $0.47 | $200 | Langfuse/support at 50/80/100% | revoke `AI_GATEWAY_API_KEY` |
| AI Gateway - OpenAI | live `/api/ai-logs` split by provider | $0.06 | $40 | Langfuse/support at 50/80/100% | route OpenAI off |
| AI Gateway - Google | live `/api/ai-logs` split by provider | $0.06 | $40 | Langfuse/support at 50/80/100% | route Gemini off |
| Supabase storage | Supabase Billing → Usage snapshot | $0.006 | $10 | storage alert at 50/80/100% | disable uploads |
| Supabase egress | Supabase Billing → Usage snapshot | $0.006 | $15 | egress alert at 50/80/100% | block downloads |
| Vercel hosting | Vercel Usage snapshot | $0.00 | $20 | Vercel email/web at 50/75/100% | pause projects |
| Supabase database/auth | Supabase Billing → Usage snapshot | $0.00 | $25 | Cost Control alert at 80% | pause project |
| Anthropic direct | Console usage limits | $0.00 | $50 | email at 50/80/100% | revoke key |
| OpenAI direct | Platform usage limits | $0.00 | $50 | email at 50/80/100% | revoke key |
| Google AI / Vertex | Cloud Billing budget | $0.00 | $50 | email + Pub/Sub at 50/80/100% | disable billing |
| Deepgram | Console spend limit | $0.00 | $30 | email at 50/80/100% | rotate key |
| Inngest | Free-tier dashboard | $0.00 | $0 | free-tier exhaustion email | pause functions |
| Resend | Free-tier dashboard | $0.00 | $0 | free-tier exhaustion email | rotate key |
| Stripe | Radar/dashboard | $0.00 | n/a | dispute/fraud/webhook email | pause new subscriptions |

**Daily ritual during alpha:** check `/observability/burn` before inviting more testers. If any row is at or above 80%, execute that row's kill-switch, add an incident note to Linear, and do not invite additional testers until the row returns below 50%.

**Weekly ritual:** Monday morning, founder screenshots `/observability/burn` and the vendor dashboard rows that are still manual into `.ai-starter/evidence/spend-caps/<YYYY-MM-DD>/`. Cross-check against caps; adjust if any vendor is consistently above 50% or below 5% of cap.

### Internal alert webhook (PROD-371)

Set `ALERT_WEBHOOK_URL` to a Slack incoming webhook (`https://hooks.slack.com/services/...`) in Vercel envs (Production + Preview). The synthetic alert dispatcher at `POST /api/internal/alerts` posts a Slack-Block-Kit payload when any threshold breaches; full table in [`INCIDENT_RUNBOOK.md`](./INCIDENT_RUNBOOK.md#health-endpoint--alerts). When the env is unset, the dispatcher emits an `alert.would_fire` log line instead — useful for previewing thresholds before wiring a real channel.

| Env var | Required for | Notes |
| --- | --- | --- |
| `INTERNAL_ADMIN_TOKEN` | `/api/internal/health` + `/api/internal/alerts` in production | Random 32-char string; rotate alongside other secrets. Optional in dev. |
| `ALERT_WEBHOOK_URL` | Real Slack delivery | Slack-compatible incoming webhook. Falls back to log-only when unset. |

---

## Cost per meeting (gross-margin sanity check)

Assumptions for the **Core $20 tier** with 20 meetings/month per user, average 30-min meeting:

| Component | Per meeting | Per user/mo (20 meetings) | Notes |
| --- | --: | --: | --- |
| STT (AssemblyAI batch, 30 min @ $0.12/hr) | $0.060 | $1.20 | Primary cost driver |
| LLM summary + embeddings (gateway, ~5K input + 1K output tokens, Sonnet 4.6) | $0.045 | $0.90 | Includes embedding pass |
| LLM ad-hoc chat (assume 5 turns @ ~3K tokens) | $0.025 | $0.50 | MCP / chat surface |
| Supabase storage (audio + transcript ~5 MB/meeting) | $0.0008 | $0.016 | $0.021/GB/mo |
| Supabase egress (transcript reads, ~10 MB) | $0.0009 | $0.018 | $0.09/GB |
| Resend onboarding email | $0.000 | $0.000 | Free tier |
| AI Gateway markup | $0.000 | $0.000 | Verified zero markup (see `vercel.com/docs/ai-gateway/pricing`) |
| **Total COGS** | **$0.132** | **$2.63** | |
| **Revenue** | | **$20.00** | Core tier |
| **Gross margin** | | **$17.37 / 87%** | Healthy buffer |

**At 10 alpha users:** ~$26/mo vendor spend. Combined caps ($425/mo) provide >15x runway against accidents.

**Margin watchlist (flag if gross margin drops below 50%):**
- AssemblyAI streaming (live captions). At ~$0.15/hr, heavy streaming users could 3x the STT cost. If a user hits >40 hrs/mo of streaming, gross margin on that user dips to ~75% — still safe, but track.
- LLM context bloat. If we start sending full transcripts on every chat turn, a single user could 5x LLM cost. Mitigate via embedding-based RAG (already in plan).
- Supabase egress. Mobile app re-pulling audio could spike egress. Cap with signed-URL TTL + client cache.

**No vendor currently breaks the 50% gross-margin floor at expected alpha usage.** Re-run this math before each major release.

---

## Verification before each major release

This checklist runs before any promotion to `main` (i.e. before any user-facing release). Cross-referenced from `docs/RELEASE.md`.

1. [ ] All vendor rows above have a configured cap or explicit 80% alert, verified by visiting the dashboard and screenshotting the cap value into `.ai-starter/evidence/spend-caps/<YYYY-MM-DD>/`.
2. [ ] No alert email has fired in the last 24 hrs (search `support@mirrorfactory.ai` for `[Spend]`, `[Budget]`, `[Usage]`).
3. [ ] `/observability/burn` is sorted by `% of cap`; every row is below 80%.
4. [ ] AI Gateway balance > $80 (40% of cap). Top up if lower. Anthropic/OpenAI/Google provider run-rates are each below 80%.
5. [ ] Supabase Spend Cap toggle is **on**. Storage run-rate is < `$10/mo`; egress run-rate is < `$15/mo`.
6. [ ] AssemblyAI usage trend over last 7 days extrapolates to < $50 for the month.
7. [ ] Stripe Radar rules are active; no disputed charges in the last 7 days.
8. [ ] Langfuse cost dashboard for the last 24 hrs shows no anomalous user (>10x median spend).
9. [ ] Confirm `INCIDENT_RUNBOOK.md` is reachable from `docs/` and on-call (founder) has it bookmarked.

If any item fails, **block the release** and resolve before continuing.

---

## Change log

- 2026-05-08 — added `/observability/burn` dashboard registry, AI Gateway provider sub-budgets, and separate Supabase storage/egress sub-limit procedures for PROD-396.
- 2026-05-01 — initial doc, alpha launch caps. Verified Vercel + Supabase paths via vendor docs; AssemblyAI/Deepgram/Resend/Inngest dashboard paths marked "verify in dashboard" because docs were unreachable at write-time.
