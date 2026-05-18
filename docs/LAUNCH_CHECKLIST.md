# Layers Launch-Day Checklist (v0)

Tracks: [PROD-369](https://linear.app/mirror-factory/issue/PROD-369)

> **Status:** v0 skeleton. This is the conditional run-order for launch day. Each item gets fleshed out as the underlying M6 ticket closes. If an upstream PROD ticket is still open, **skip** the dependent item and write a one-line note in the post-launch retrospective.
>
> Companion docs:
> - [SPEND_CAPS.md](./SPEND_CAPS.md) — vendor caps, alert mailbox, kill-switches
> - [KEY_ROTATION.md](./KEY_ROTATION.md) — rotation schedule + procedure
> - [RECORDING_MANUAL_QA.md](./RECORDING_MANUAL_QA.md) — 5-device manual QA pass
> - [SUPABASE_PROD_MIGRATION.md](./SUPABASE_PROD_MIGRATION.md) — prod migration audit + RLS plan
> - [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md) — rollback + paging procedures
> - [RELEASE.md](./RELEASE.md) — branch flow, Vercel envs, OAuth allow-lists

## How to use this doc

Each row uses the form:

```
- [ ] **PROD-XXX**: short imperative
      - **Skip if**: condition (usually "PROD-XXX is still open")
      - **Verify**: how to confirm the item is done
```

If the "Skip if" condition is true, **do not run the item** and note `skipped: PROD-XXX open` in the launch report. The day-of operator should walk the doc top-to-bottom in order. Anything in **Pre-launch (T-7)** that is still open by T-3 escalates to a launch-blocker decision: ship anyway, delay, or descope.

---

## Pre-launch (T-7 days)

Lock the long-lead items a week out. Anything still open here at T-1 is a launch decision, not a check.

- [ ] **PROD-224**: All Supabase production migrations applied.
      - **Skip if**: PROD-224 is still open. Block launch — production schema must match `main`.
      - **Verify**: `supabase db diff --linked` returns empty against the production project; `docs/SUPABASE_PROD_MIGRATION.md` "Post-migration sign-off" section is checked. RLS audit findings flagged in PROD-224 are closed.

- [ ] **PROD-396**: All vendor spend caps configured.
      - **Skip if**: PROD-396 is still open. Block launch — uncapped vendors are not allowed for the public launch.
      - **Verify**: every vendor in the [SPEND_CAPS.md](./SPEND_CAPS.md) cap matrix has its cap, alert threshold, and kill-switch confirmed in the vendor dashboard. Screenshot the cap config into the launch evidence folder.

- [ ] **PROD-407**: All API keys rotated and repo confirmed private.
      - **Skip if**: PROD-407 is still open. Block launch — assume any pre-rotation key is leaked.
      - **Verify**: each env var listed in [KEY_ROTATION.md](./KEY_ROTATION.md) has a rotation timestamp ≥ T-7. `gh repo view --json visibility` returns `PRIVATE`. No keys present in `.env*`, `git log -p`, or Vercel preview branches outside the allowlist.

- [ ] **PROD-471**: Apple Developer account verified.
      - **Skip if**: PROD-471 is still open. iOS launch slips to next window; web/Android launch can proceed.
      - **Verify**: App Store Connect shows account status Active, paid, with valid D-U-N-S; team ID `36J9E4325G` is linked.

- [ ] **PROD-472**: Google Play account verified.
      - **Skip if**: PROD-472 is still open. Android launch slips to next window; web/iOS launch can proceed.
      - **Verify**: Play Console shows developer verification Complete and payment profile linked.

- [ ] **PROD-364**: iOS TestFlight build uploaded.
      - **Skip if**: PROD-364 is still open **or** PROD-471 was skipped. No iOS launch in this window.
      - **Verify**: TestFlight shows the launch build processed (not "Missing Compliance"); external testers group has access; install + cold-launch on a real device succeeds.

- [ ] **PROD-365**: Android signed AAB uploaded.
      - **Skip if**: PROD-365 is still open **or** PROD-472 was skipped. No Android launch in this window.
      - **Verify**: Play Console internal testing track shows the AAB Rolled out; install via internal-testing opt-in link succeeds on a real device.

- [ ] **PROD-357**: App Store assets and Privacy Nutrition submitted.
      - **Skip if**: PROD-357 is still open **or** PROD-471 was skipped. No iOS launch in this window.
      - **Verify**: App Store Connect "Prepare for Submission" page is fully green (screenshots, description, keywords, App Privacy answers, review notes, support URL).

- [ ] **PROD-359**: Play Data Safety form submitted.
      - **Skip if**: PROD-359 is still open **or** PROD-472 was skipped. No Android launch in this window.
      - **Verify**: Play Console "Data safety" page shows status Submitted (or Approved) with the latest content review answers matching `app/privacy/page.tsx`.

- [ ] **PROD-225**: Stripe production keys swapped.
      - **Skip if**: PROD-225 is still open. Launch on live keys is blocked — either delay or launch in test mode and disable paid signups.
      - **Verify**: Vercel production env shows live `STRIPE_SECRET_KEY`, `STRIPE_PRICE_CORE`, `STRIPE_PRICE_PRO`, and live `STRIPE_WEBHOOK_SECRET`. A `$0.50` test checkout against live mode succeeds end-to-end and the webhook flips `profiles.subscription_tier` in production Supabase.

- [ ] **PROD-477**: Manual real-device QA pass complete on 5 devices.
      - **Skip if**: PROD-477 is still open. Web launch can proceed if web routes pass desktop+mobile Playwright; native launch is blocked.
      - **Verify**: [RECORDING_MANUAL_QA.md](./RECORDING_MANUAL_QA.md) results table has 5 of 5 devices marked Pass with screenshots in the evidence folder.

---

## Launch day (T-0)

Walk this section linearly the morning of launch. Stop on the first hard failure and escalate per [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md).

- [ ] **PROD-369-A**: Confirm Vercel deploy from `main` is green.
      - **Skip if**: never — this is a hard gate. If red, do not announce.
      - **Verify**: Vercel dashboard shows the latest `main` commit as Ready on `layers.mirrorfactory.ai`; production domain returns 200 on `/`, `/pricing`, `/download`, `/sign-in`.

- [ ] **PROD-369-B**: Run `pnpm gates` locally and verify all required gates pass.
      - **Skip if**: never — hard gate.
      - **Verify**: `pnpm gates` exits 0; the gates report is saved into the launch evidence folder. Any "recommended" gate failure is noted but does not block.

- [ ] **PROD-397**: Verify GCP billing fully paid.
      - **Skip if**: PROD-397 is still open. Block launch of anything that hits Google Cloud (Vertex, Calendar, OAuth). Web/Stripe-only launch may still proceed if no GCP dependencies are live.
      - **Verify**: GCP Cloud Billing shows the launch-window project with status Active, no overdue invoices, budget alerts armed.

- [ ] **PROD-369-C**: Verify health endpoint returns 200.
      - **Skip if**: never — hard gate.
      - **Verify**: `curl -H "x-admin-token: $LAYERS_ADMIN_TOKEN" https://layers.mirrorfactory.ai/api/internal/health` returns 200 with `status: "ok"` and every downstream check `ok: true` (Supabase, Stripe, AI gateway, transcription).

- [ ] **PROD-369-D**: Send launch email to invite list (if Resend wired).
      - **Skip if**: Resend env (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`) is not configured in production, or the email-send PROD ticket is still open.
      - **Verify**: Resend dashboard shows the broadcast Sent with a non-zero delivered count; no hard bounces over 1% of sent.

- [ ] **PROD-391 / PROD-392**: Post LinkedIn and Mirror Factory blog announcement.
      - **Skip if**: PROD-391 is still open (skip LinkedIn) and/or PROD-392 is still open (skip blog). One can proceed without the other.
      - **Verify**: live URLs of LinkedIn post and `mirrorfactory.ai/blog/...` are linked into the launch report; both load anonymously.

- [ ] **PROD-369-E**: Watch the Langfuse burn-rate dashboard for the first hour.
      - **Skip if**: never — hard gate during launch hour.
      - **Verify**: Langfuse `burn-rate` dashboard is pinned in a tab; spend trend over the first 60 minutes is within 2× the [SPEND_CAPS.md](./SPEND_CAPS.md) per-meeting cost-per-active-user assumption. Spike > 5× triggers the incident runbook.

---

## Day-1 watchlist (T+1)

Tour these the morning after launch. Anything red here turns into a Linear `kind:bug` ticket and is folded into the week-1 retro.

- [ ] **PROD-396 (recurring)**: Confirm spend caps are still configured per `docs/SPEND_CAPS.md`.
      - **Skip if**: never — vendors occasionally reset caps on plan upgrades; re-check daily for the first week.
      - **Verify**: each vendor in the [SPEND_CAPS.md](./SPEND_CAPS.md) matrix still shows the documented cap and alert threshold. Diff against the T-7 screenshot.

- [ ] **PROD-369-F**: Watch `admin@mirafactory.ai` for `[Spend]`, `[Budget]`, `[Usage]` alert subjects.
      - **Skip if**: never.
      - **Verify**: inbox has no unhandled alert; any matching email is triaged within 1 hour and linked into the launch report.

- [ ] **PROD-369-G**: Check `/observability` for any error rate > 1%.
      - **Skip if**: `/observability` page or its underlying telemetry is not wired in production. Note as a follow-up and use Vercel logs + Langfuse instead.
      - **Verify**: error-rate panel shows < 1% over the trailing 24h for every surface (chat, recording, transcription, billing, auth). Anything > 1% gets a bug ticket.

- [ ] **PROD-369-H**: Sample 3–5 user meetings end-to-end.
      - **Skip if**: never — this is the primary product confidence check.
      - **Verify**: pick 3–5 real user meetings from the last 24h and confirm the full pipeline ran: recording captured, transcript generated, summary written, in-meeting chat usable, and MCP surface reachable from Claude Desktop. Any gap becomes a `kind:bug` ticket with the meeting ID redacted.

---

## Week-1 retrospective

Do this at T+7. Compile what we learned before scoping the next slice.

- [ ] **PROD-369-I**: Aggregate cost-per-active-user vs `docs/SPEND_CAPS.md` cost-per-meeting math.
      - **Skip if**: spend data is unavailable (fewer than 5 active users, vendor invoices not yet finalized). Defer to T+14.
      - **Verify**: total vendor spend ÷ active users for the week is calculated and compared to the per-meeting model in [SPEND_CAPS.md](./SPEND_CAPS.md). Variance is logged in the retro doc; caps are adjusted if reality diverges > 25%.

- [ ] **PROD-369-J**: Survey first testers on top friction point.
      - **Skip if**: fewer than 5 active users in the week — defer until the cohort is large enough to be useful.
      - **Verify**: 5+ short responses collected (email or in-app), themes summarized in 3–5 bullets, top-friction items filed as Linear issues.

- [ ] **PROD-369-K**: Triage Linear `kind:bug` tickets created since launch.
      - **Skip if**: never.
      - **Verify**: every `kind:bug` ticket created since the launch tag has a priority and an owner; P0/P1 bugs have an ETA. Triage notes are added to the retro doc.

---

## Notes for the operator

- **This is v0.** Items will get more specific commands, expected outputs, and rollback notes as the underlying M6 tickets close. If you find yourself improvising a step, write it down in the launch report and turn it into a new line in this checklist.
- **Hard gates** are explicitly labeled `Skip if: never`. They block launch — there is no override.
- **Soft gates** (anything with a real `Skip if`) degrade gracefully. Skipping is fine; silent skipping is not. Note every skip in the launch report.
- For any rollback decision, follow [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md). For any branch/deploy decision, follow [RELEASE.md](./RELEASE.md).
