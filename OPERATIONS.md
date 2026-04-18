# Operations runbook

Day-2 for running audio-layer. Read `SETUP.md` first (env + one-time dashboard clicks); this file covers everything after first deploy.

## Daily / weekly checks

| Frequency | Check | Where |
|---|---|---|
| On every deploy | `pnpm test:all` passes | local or CI |
| Daily | Vercel deployment health — no failed deploys | vercel.com dashboard |
| Daily | Langfuse traces arriving with non-zero cost | cloud.langfuse.com |
| Daily | Stripe webhook delivery rate is 100% | Stripe → Developers → Webhooks |
| Weekly | Supabase DB size + row counts | supabase.com → your project → Reports |
| Weekly | Cost reconciliation: our `/usage` total ≈ Vercel AI Gateway + AssemblyAI invoices | dashboards + `/usage` |
| Monthly | Pricing table drift: diff `lib/billing/llm-pricing.ts` against published rates | anthropic.com/pricing, etc. |

## Testing

### What runs where

```
┌───────────────────────────────────────────────────────────┐
│  Every git commit          (Husky pre-commit hook)        │
│    pnpm typecheck                                         │
│    pnpm test                                              │
├───────────────────────────────────────────────────────────┤
│  Every git push            (Husky pre-push hook)          │
│    pnpm typecheck                                         │
│    pnpm test                                              │
│    pnpm compliance   (advisory — `|| echo`, won't block)  │
├───────────────────────────────────────────────────────────┤
│  Manual / CI               (`pnpm test:all` entrypoint)   │
│    pnpm typecheck                                         │
│    pnpm test                                              │
│    pnpm test:e2e   (Playwright smoke + record + meetings) │
├───────────────────────────────────────────────────────────┤
│  Manual only               (live-API tests, cost $)       │
│    pnpm eval:live  (reference chat tool-selection)        │
└───────────────────────────────────────────────────────────┘
```

### Test categories currently in the repo

| Category | Files | Count | What it verifies |
|---|---|---|---|
| Unit — pricing | `tests/billing-*.test.ts` | 3 files, 25 tests | Pricing table lookups, cost math, cached-input discount, formatUsd buckets |
| Unit — schemas | `tests/assemblyai-schema.test.ts`, `intake-schema.test.ts` | 2 files, 12 tests | Zod schema parses valid payloads + rejects malformed ones |
| Unit — cache | `tests/meetings-store.test.ts` | 1 file, 9 tests | InMemory store CRUD, FIFO eviction, partial updates |
| Unit — exports | `tests/meeting-export.test.ts`, `meeting-pdf.test.ts` | 2 files, 12 tests | Markdown output shape + PDF byte signature |
| Unit — clients | `tests/assemblyai-client.test.ts`, `stripe-client.test.ts`, `langfuse-api.test.ts` | 3 files, 16 tests | Null-when-env-missing, Basic-auth header, tier mapping |
| Unit — audio | `tests/pcm-downsampler.test.ts` | 1 file, 6 tests | PCM downsampling math (48k→16k, int16 clamping) |
| Unit — registry | `tests/tool-registry.test.ts` | 1 file, 14 tests | Starter-kit tool-meta + registry sync |
| Unit — aggregator | `tests/billing-usage-aggregator.test.ts` | 1 file, 5 tests | Local meetings aggregation math |
| e2e — smoke | `tests/e2e/smoke.spec.ts` | 1 file | Every page loads without console errors |
| e2e — route-specific | `tests/e2e/record.spec.ts`, `record-live.spec.ts`, `meetings.spec.ts` | 3 files | Page renders, buttons + links exist, 404 for bad ids |
| e2e — visual | `tests/e2e/visual-regression.spec.ts` | 1 file | Screenshot diff against baseline |
| e2e — mobile | `tests/e2e/mobile.spec.ts` | 1 file | Page renders at mobile viewport |

**Total: 106 unit tests + 6 e2e specs. All passing.**

### What's NOT tested (honest list)

The unit tests use mocks and pure logic. They don't prove that the real SDKs work. The real failure modes — API auth, network retries, webhook signature handling, RLS policies — aren't exercised here:

- ❌ **No live AssemblyAI test** — never confirms the SDK produces a non-zero `audio_duration` on a real file.
- ❌ **No live Gateway test** — never confirms `generateObject` actually returns a valid `MeetingSummary`.
- ❌ **No live Supabase test** — RLS policies aren't proven; the schema might let a different user read your meetings and we'd never know.
- ❌ **No Stripe webhook test** — we verify `tier ↔ priceId` mapping but not the full signed-event → profile-update flow.
- ❌ **No full e2e "record a real meeting"** — Playwright tests load pages but don't upload audio.
- ❌ **No eval for summary/intake LLM quality** — the schema validates, but "does the output make sense?" is never checked.

See `VERIFICATION_GAPS.md` for the per-item verification command.

### Commands

```bash
# Fast feedback (runs on every commit)
pnpm test              # vitest unit tests
pnpm typecheck         # tsc --noEmit

# Before pushing
pnpm test:all          # typecheck + unit + e2e

# Individual e2e specs
pnpm test:smoke        # page loads
pnpm test:visual       # visual regression
pnpm test:mobile       # mobile viewport

# Starter-kit compliance (12 pattern checks)
pnpm compliance

# Real AI call (costs ~$0.01-0.05)
pnpm eval:live

# Performance
pnpm test:load         # k6-style load test (local dev server only)
```

### Adding a test

Unit tests live in `tests/*.test.ts`. Co-locate fixtures, use the Zod schemas from `lib/assemblyai/*` for shape checks, and import test seams (`__resetAssemblyAIClient`, `__clearSummaryCache`, etc.) when the code under test has cached state.

e2e tests in `tests/e2e/*.spec.ts` use Playwright. Don't hit real APIs — if you need auth state, stub it via cookies or skip the test with a clear `test.skip("needs real supabase", ...)`.

## Monitoring

### What to watch

**Vercel dashboard:**
- Deployments — any red? Rollback via dashboard.
- Functions → Usage — which routes are hot? Any hitting timeouts?
- Logs — filter by `status:5xx` after every release.

**Langfuse:**
- Daily cost trend should mirror `/usage` aggregates.
- If cost shows zero while `traceCount > 0` — the `after(flushLangfuse)` fix is broken again. Check `lib/langfuse-setup.ts` and re-verify `instrumentation.ts` runs.

**Supabase:**
- `meetings` row count — growth rate sanity check.
- RLS audit: run `select * from pg_policies where tablename in ('meetings','profiles');` should return 5 rows (4 meetings + 1 profile SELECT).
- Stale rows: any `status='processing'` older than 10 minutes is abandoned — either AssemblyAI errored silently or our route crashed.

**Stripe:**
- Dashboard → Developers → Webhooks → our endpoint — delivery rate should be 100% over rolling 24h.
- If a webhook fails repeatedly (3+ times), Stripe gives up. Manually replay from the dashboard.

**In-app `/observability`:**
- Per-process ring buffer of AI calls. Useful for debugging a single deploy; lost on redeploy. For authoritative history, use Langfuse.

### Alerts to set up

Not wired today — list for when ready:

- Vercel: 5xx rate > 1% over 5 min → page
- Supabase: connection pool saturation → page
- Stripe: webhook delivery failure → email
- Langfuse: daily cost > $50 → email (burn-rate canary)

## Troubleshooting

### "Langfuse shows zeros"

- Root cause almost always: `after(flushLangfuse)` missing from a route, or `instrumentation.ts` not running.
- Verify: `curl https://<app>/api/transcribe/...` and check the function logs for the "`[langfuse] forceFlush failed`" line. If absent, `flushLangfuse` isn't being called.
- See VERIFICATION_GAPS.md #1 of the flush fix history.

### "Transcription stuck in `processing`"

- Check Vercel function logs for the route. Look for "AssemblyAI get failed".
- Fetch the AssemblyAI transcript directly: `curl -H "Authorization: $ASSEMBLYAI_API_KEY" https://api.assemblyai.com/v2/transcript/<id>` — if `status: "error"`, their `error` field tells you why.
- Our route updates the row on next poll — if the client stopped polling, manually POST to `/api/transcribe/<id>` to trigger a single poll.

### "User sees HTTP 402 but they just signed up"

- The quota check runs against ALL their meetings, including anonymous ones before they signed in. If the anonymous account created 25+ meetings and then upgraded, the anonymous account's meetings aren't attached to the new user (VERIFICATION_GAPS.md #6).
- Workaround until `linkIdentity()` lands: manually upsert their subscription to `active` in Supabase, or bump the free-tier limit in `lib/billing/quota.ts`.

### "Stripe webhook returns 400 Signature verification failed"

- Ensure `STRIPE_WEBHOOK_SECRET` is the one Stripe shows in **this specific endpoint's** settings (not a different endpoint, not test mode vs live mode).
- The webhook endpoint must receive the RAW body — if any middleware JSON-parses first, signatures fail. Our route uses `await request.text()` — don't change that.

### "PDF export 500s"

- `@react-pdf/renderer` sometimes fails on fonts. If the error mentions "font not found", verify the server has the Helvetica PostScript names registered. Fall back to a plain system font in `lib/meetings/pdf.tsx`.

### "Meetings vanish on reload"

- Supabase not configured — `MeetingsStore` is falling back to in-memory. Check logs for `[meetings] SUPABASE_URL not set — using in-memory store`.

### "Local dev can't sign in with magic link"

- Supabase Auth → URL Configuration → add `http://localhost:3000/auth/callback` to the redirect allow-list. Without it, the magic link redirects to a 404.

### "Android mic prompt appears but getUserMedia rejects"

- `mobile/patches/apply-mainactivity.sh` didn't run or didn't patch successfully. Check `android/app/src/main/java/.../MainActivity.*` — should have `onPermissionRequest` override. If missing, re-run `bash mobile/patches/apply-mainactivity.sh android/app/src/main/java`.

### "Tauri build fails on macOS"

- Rust version: needs 1.77+. Upgrade via `rustup update`.
- `screencapturekit` crate: requires macOS SDK 14.0+. Check Xcode version with `xcodebuild -version`.
- Info.plist: Tauri should merge `src-tauri/Info.plist` into the app bundle. If the mic prompt doesn't appear, verify with `plutil -p <app.app>/Contents/Info.plist`.

## Deploy

### Pre-deploy checklist

- [ ] `pnpm test:all` passes locally
- [ ] `pnpm compliance` shows 0 errors (2 warnings are known, see VERIFICATION_GAPS.md)
- [ ] Env vars in Vercel dashboard match `.env.example` (tiers 1–4 from `SETUP.md`)
- [ ] `lib/supabase/schema.sql` has been run against the prod Supabase project
- [ ] Anonymous sign-ins enabled in Supabase
- [ ] `/auth/callback` URL in Supabase redirect allow-list
- [ ] Stripe webhook endpoint URL + secret registered in prod Stripe
- [ ] `STRIPE_PRICE_CORE` + `STRIPE_PRICE_PRO` point at prod (not test-mode) prices
- [ ] Langfuse project exists and keys in env

### Deploy

```bash
# Push to main; Vercel auto-deploys from the connected branch.
git push origin main

# Watch the deploy
open https://vercel.com/<team>/<project>
```

### Rollback

Dashboard only — Vercel's "Promote to Production" on any past deploy. No migrations currently that would need reverting.

## Pricing table updates

When Anthropic / AssemblyAI / OpenAI / Google publish new rates:

1. Edit `lib/billing/llm-pricing.ts` and/or `lib/billing/assemblyai-pricing.ts`.
2. Update `tests/billing-llm-pricing.test.ts` / `tests/billing-assemblyai-pricing.test.ts` for any expected-value changes.
3. Update `COSTS.md` per-meeting math section.
4. Run `pnpm test`.

Cached-input discount for Anthropic is hardcoded at 10% of input; verify that's still accurate when you update.

## Upgrading LLM model

New model via Gateway:

1. Add the provider-prefixed id to `lib/settings-shared.ts` `MODEL_OPTIONS.summary`.
2. Add pricing row to `lib/billing/llm-pricing.ts` `COST_PER_M_TOKENS`.
3. Test in `/settings` — pick the new model, record a short meeting, verify summary renders + cost tracks.
4. Consider setting it as `DEFAULT_MODEL` via Vercel env once proven.

## Emergency: turn off AI

- Unset `AI_GATEWAY_API_KEY` in Vercel → redeploy. Summary + intake + chat fail gracefully (partial-success persist keeps the transcript).
- To also disable transcription: unset `ASSEMBLYAI_API_KEY` → `/record` and `/record/live` return 500 on start. Prevents any AI spend while preserving `/meetings` read access.

## Backup / restore

Supabase Pro plan includes point-in-time recovery (7 days). Nothing else to set up — the `meetings` and `profiles` tables are the only state we own.
