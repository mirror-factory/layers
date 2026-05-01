# Incident Runbook

> Read this at 3am. Each scenario is **Detection → Immediate action → Recovery → Postmortem**, in that order. Companion docs: [SPEND_CAPS.md](./SPEND_CAPS.md), [RELEASE.md](./RELEASE.md), [POST_LAUNCH_MONITORING.md](./POST_LAUNCH_MONITORING.md).

---

## Severity tiers

| Tier | Definition | Response | Who to call |
| --- | --- | --- | --- |
| **P0** | Production fully down, billing broken, security breach (leaked key, data exposed). All paying users affected. | Drop everything. Ack within 10 min. Public status update within 30 min. | Founder (Alfonso). |
| **P1** | Major degradation: a core feature (recording, transcription, login) broken for a meaningful subset of users, OR a spend cap tripped and revenue/runway is at risk. | Ack within 30 min. Mitigate within 2 hrs. | Founder. |
| **P2** | Single user / non-blocking bug, slow background job, cosmetic regression, near-cap spend warning. | Triage during business hours. | Founder. |

**Default on-call:** founder, until further notice. Paging: email to `support@mirrorfactory.ai` (alert source), SMS via Vercel Spend Management for spend events, manual escalation otherwise.

---

## Scenarios

### 1. AI Gateway over budget — daily or monthly cap hit

- **Trigger:** Linear ticket [PROD-396](https://linear.app/mirror-factory/issue/PROD-396) covers the long-term cap automation. Env var: `AI_GATEWAY_API_KEY`.
- **Severity:** P1 (LLM features fail across the app).
- **Detection:**
  - Vercel AI Gateway dashboard balance shows $0 or near-zero (`vercel.com/<team>/~/ai-gateway`).
  - 402 / "Insufficient credits" errors in `app/api/chat/**` route logs (Vercel runtime logs).
  - Langfuse traces flag a sudden cost spike (look for one user >10x median spend).
  - Spike of `CHAT ROUTE ERROR:` entries in Vercel runtime logs.
- **Immediate action (<2 min):**
  1. **If a single user is the cause:** disable that user (see scenario 8) — do NOT top up first.
  2. **If broad usage:** Vercel → AI Gateway → top up just enough to recover ($50). Do not raise the cap permanently in the heat of the moment.
  3. If a runaway loop is suspected (server hammering itself), set `AI_GATEWAY_API_KEY` to an invalid placeholder in Vercel Production env and redeploy. This kills the bleed in <90s.
- **Recovery:**
  1. Identify the specific tool / route / user from Langfuse traces.
  2. Add a per-user rate limit (`lib/ai/rate-limit.ts` if it exists; otherwise add) before re-enabling.
  3. Restore `AI_GATEWAY_API_KEY` to the correct value in Vercel env, redeploy, smoke-test `/api/chat` health endpoint.
  4. Top up to a normal cushion (~$200) only after root cause is pinned.
- **Postmortem:** Linear ticket titled `Incident: AI Gateway burst <date>`. Required fields: detection time, mitigation time, root cause, $ burned, prevention. Link the Langfuse trace and the offending PR/commit.

### 2. Supabase project paused / hard cap hit — DB unavailable

- **Trigger:** Linear remediation: _follow-up TBD_ (Supabase egress alerting + auto-archive of old audio). Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Severity:** P0 (entire app unusable; auth + DB + storage all gone).
- **Detection:**
  - All API routes return 500s; UI shows blank states.
  - Vercel runtime logs: `PostgrestError` / `Failed to fetch` from `lib/supabase/**`.
  - Supabase dashboard banner: "Project paused due to spend cap" or "Project paused due to inactivity".
  - Email alert from Supabase billing.
- **Immediate action (<2 min):**
  1. Supabase Dashboard → project → **Settings → General → Restore project** (if paused due to inactivity / hard cap). Restore takes ~2–5 min.
  2. If restore not available because monthly Spend Cap engaged → Org → Billing → **Cost Control → Increase cap** by $25 (one-shot decision). Document why in the postmortem.
  3. Status banner in app (`components/site/status-banner.tsx`) → manual notice "DB issues — investigating".
- **Recovery:**
  1. Once restored, run `pnpm test` smoke and exercise auth, recording start, transcript fetch.
  2. Check egress trend in dashboard — was this driven by a single user re-pulling audio? If so, gate audio downloads behind a 1-per-minute rate limit.
  3. Re-enable Spend Cap to the new limit, NOT to "off".
- **Postmortem:** Linear ticket. Required: time-to-restore, root cause (most likely egress spike or storage growth), and a concrete prevention (e.g. "add 30-day audio retention policy").

### 3. AssemblyAI / Deepgram out of credits — STT failures

- **Trigger:** Env vars: `ASSEMBLYAI_API_KEY`, `DEEPGRAM_STREAMING_MODEL` (Deepgram key when added). Linear remediation: _follow-up TBD_ (auto-failover between providers).
- **Severity:** P1 (recordings still happen, but post-meeting transcript is missing or live captions stop).
- **Detection:**
  - `app/api/transcribe/**` returns 401/402 errors in Vercel runtime logs.
  - User reports "transcript stuck at 'Processing'".
  - AssemblyAI dashboard: balance / usage at cap.
  - Provider's email alert fires.
- **Immediate action (<2 min):**
  1. Switch the runtime transcription provider in `lib/recording/transcription-provider.ts` from `assemblyai` to `deepgram` (or vice-versa). This is a one-line config change deployed via env var; no code change needed if both provider envs are set.
  2. If both providers are out: post a status-banner notice "transcription temporarily delayed; recordings are saved and will be processed shortly".
  3. Pause queued retranscription jobs (Inngest dashboard → Functions → pause `retranscribe` once Inngest is wired).
- **Recovery:**
  1. Top up the depleted provider. Set per-month cap higher only if the spike was legitimate user growth, not abuse.
  2. Re-queue any failed transcripts; verify the row in `recordings` table updates status `processing → completed`.
  3. Switch primary provider back if desired.
- **Postmortem:** Linear ticket. Capture which provider failed, $ amount, whether failover worked, and any user-facing communication that went out.

### 4. Vercel deployment broken on `main` — public outage

- **Trigger:** Linear remediation: existing release-flow guard ([PROD-383](https://linear.app/mirror-factory/issue/PROD-383)).
- **Severity:** P0.
- **Detection:**
  - `layers.mirrorfactory.ai` returns 500 / blank / build error page.
  - Vercel Deployments tab shows red status on the latest production deploy.
  - `pnpm typecheck` would catch it locally but didn't (means CI was bypassed or hook misfired).
- **Immediate action (<2 min):**
  1. Vercel Dashboard → **Deployments** → find the last green production deploy → click **... → Promote to Production**. Site is back in <60s.
  2. Do NOT push a "fix" to `main` — that doubles the risk surface. Roll back first, debug after.
- **Recovery:**
  1. On a feature branch off `development`, reproduce the bug, fix, run `pnpm typecheck && pnpm test && pnpm gates`.
  2. Ship via the normal `feature → development → staging → main` flow (see `RELEASE.md`). Do not hotfix unless the rollback itself broke something.
- **Postmortem:** Linear ticket. Ask: how did this bypass `staging` soak? Was a check skipped? Tighten the gate that failed.

### 5. Google Cloud payment decline / project suspension — OAuth + Calendar broken

- **Trigger:** Linear ticket [PROD-397](https://linear.app/mirror-factory/issue/PROD-397). Env vars: any `GOOGLE_*` (`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`).
- **Severity:** P1 (sign-in via Google + Calendar integration fail; email/password sign-in still works).
- **Detection:**
  - Google OAuth callback returns `invalid_client` or `access_denied`.
  - `lib/calendar/providers.ts` throws `403 BillingDisabled` from Calendar API.
  - GCP email: "Billing disabled on project <id>".
- **Immediate action (<2 min):**
  1. Cloud Console → **Billing** → re-attach a working payment method or link a different billing account.
  2. Wait ~5 min for the project to come back online; APIs auto-resume.
  3. If payment can't be fixed in <30 min: hide the "Sign in with Google" button via a feature flag (or temporarily comment out the provider in `app/(public)/sign-in/page.tsx`); leave email/password path live.
- **Recovery:**
  1. Confirm Calendar API + OAuth flow work end-to-end with a test user.
  2. Re-enable the Google sign-in button.
  3. Verify billing alert thresholds in `SPEND_CAPS.md` §6 are still configured.
- **Postmortem:** Linear ticket [PROD-397]. Long-term automation is a Cloud Function listening to Pub/Sub topic on the budget alert that disables billing automatically — separate from manual remediation.

### 6. Stripe webhook signature mismatch storm — billing reconciliation paused

- **Trigger:** Env var: `STRIPE_WEBHOOK_SECRET`. Linear remediation: _follow-up TBD_ (webhook idempotency + signature alerting).
- **Severity:** P1 (subscriptions sync stops; users may see wrong tier; no immediate revenue loss).
- **Detection:**
  - Spike of `signature_verification_failed` in `app/api/stripe/webhook/route.ts` logs.
  - Stripe Dashboard → **Developers → Webhooks → <endpoint>** → 4xx response rate spikes.
  - Email from Stripe: "Webhook endpoint failing".
- **Immediate action (<2 min):**
  1. Stripe Dashboard → **Developers → Webhooks** → identify the failing endpoint (live vs test).
  2. Compare the signing secret displayed in Stripe with `STRIPE_WEBHOOK_SECRET` in Vercel env (Production for live, Preview for test). They must match exactly per environment.
  3. If mismatch: copy the right secret from Stripe → paste into Vercel env → redeploy.
  4. Stripe Dashboard → **Webhooks → Resend events** for the last 24 hrs once the secret is correct.
- **Recovery:**
  1. Verify subscription rows in `subscriptions` table reflect Stripe state (`pnpm tsx scripts/reconcile-stripe.ts` if such a script exists; otherwise spot-check a few users).
  2. Manually fix any user whose tier didn't sync.
- **Postmortem:** Linear ticket. Was the secret rotated by accident? Was a wrong env (preview vs prod) deployed? Add a startup assertion that `STRIPE_WEBHOOK_SECRET` is set and matches the expected prefix (`whsec_`).

### 7. Leaked API key suspected (any vendor) — rotation procedure

- **Trigger:** Founder spots a key in a screenshot, public repo, or Slack message. OR a vendor sends a "secret detected on GitHub" email. Env vars: every secret in `.env.example`.
- **Severity:** P0 (treat as breach until proven otherwise).
- **Detection:**
  - GitHub secret-scanning alert (Settings → Security → Secret scanning).
  - Vendor proactive email.
  - Anomalous usage pattern (massive spike from an unfamiliar IP/region).
- **Immediate action (<2 min) — in this strict order:**
  1. **Revoke the key at the vendor first** (do not wait to update the app). Each vendor's "API Keys" page has a delete/revoke action. Revoking causes failures in the app — that's acceptable for the first 5 min.
  2. **Generate a fresh key** at the vendor.
  3. **Update Vercel env vars** for **all three environments** (Production, Preview/staging, Preview/dev). Don't forget local `.env.local` for the founder.
  4. **Redeploy** all environments (Vercel team → Deployments → ... → Redeploy without cache).
  5. **Audit usage** in the vendor dashboard for the rotation window — note any unusual spend.
- **Recovery:**
  1. If the key leaked via git: `git log -p` to find the commit, then either rotate-and-leave (acceptable since the key is dead) or rewrite history if the repo is private and the commit is recent. Don't rewrite shared history without coordination.
  2. Add a pre-commit hook (gitleaks, trufflehog) if not already wired — see `.claude/skills/compliance-fix/SKILL.md`.
- **Postmortem:** Linear ticket. Capture: source of leak, dollar impact, whether rotation succeeded on first try, what scanning would have caught it earlier.

### 8. Mass abusive user — rapid recording or MCP tool spam

- **Trigger:** No specific Linear ticket; treat as ongoing operational hygiene. Env vars: `MCP_JWT_SECRET` (revocation key), `LAYERS_BYPASS_QUOTA` (must NOT be set in prod).
- **Severity:** P1 (one bad actor → all caps trip → all users affected).
- **Detection:**
  - Langfuse: one `userId` is responsible for >50% of the last hour's LLM cost.
  - Supabase: `recordings` table shows >100 inserts in 10 min from the same `user_id`.
  - Inngest backlog explodes (once wired) for jobs tagged with that user.
  - `/api/transcribe/stream/token` route returns 429 burst.
- **Immediate action (<2 min):**
  1. **Revoke the user's session:** Supabase Dashboard → **Auth → Users** → find user → **Sign out user**.
  2. **Disable the user:** flip `auth.users.banned_until = '2099-01-01'` (SQL editor) OR set their org membership row to `disabled = true` (depending on schema).
  3. **Invalidate MCP tokens:** if the user is using the MCP server, rotate `MCP_JWT_SECRET` in Vercel env (forces every MCP client to re-auth — accept the collateral damage; only 10 alpha users).
  4. Confirm the spend stops climbing in Langfuse / vendor dashboards.
- **Recovery:**
  1. Investigate intent: bug? deliberate abuse? a leaked token they're sharing?
  2. Apply per-user rate limits at the API gateway level (`app/api/transcribe/**`, `app/api/chat/**`). Add to `lib/ratelimit/` if missing.
  3. If the user is genuine and the spike was a bug, refund any incorrect charges and re-enable.
- **Postmortem:** Linear ticket. Capture: detection time, $ damage, root cause (intent), and the rate-limit / abuse-detection improvement that ships next.

---

## After every incident

1. File the Linear ticket using the template `Incident: <scenario> <date>`.
2. Required sections: timeline, detection method, mitigation steps taken, dollar impact, prevention work.
3. Cross-link from the incident ticket to any vendor remediation ticket already tracked (PROD-396 / 397 / etc.).
4. Update this runbook if the procedure changed — the doc is only useful if it stays accurate.

---

## Change log

- 2026-05-01 — initial runbook covering 8 alpha-launch scenarios. Companion to `SPEND_CAPS.md`.
