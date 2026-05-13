# Activity Log

Append-only chronological record of every PR merge, Linear ticket change, prod-impacting MCP action, and notable session checkpoint on this repo. **Required reading** before reporting "where are we at" — and required writing by any agent acting on the repo. See [Activity Log contract](../AGENTS.md#activity-log-contract) in `AGENTS.md` for what to record and when.

**One row per event.** Newest at the bottom. Don't edit prior entries — append corrections as new rows with `correction:` prefix.

Format:

```
## YYYY-MM-DD  HH:MM TZ  —  <Provider/Model>  —  <event-type>  —  <one-line summary>

- **What:** terse description
- **PR / Linear / artifact:** links
- **Why it matters:** 1–2 sentences on user impact or follow-up
```

Event types: `pr-merged`, `pr-opened`, `linear-filed`, `linear-resolved`, `linear-status-change`, `prod-migration`, `prod-incident`, `prod-hotfix`, `session-start`, `session-checkpoint`, `session-end`, `doc-shipped`, `config-change`, `hook-added`.

`<Provider/Model>` is mandatory. Examples: `Claude Opus 4.7 (1M)`, `Claude Sonnet 4.6`, `Codex CLI / GPT-5`, `Cursor / Claude 4.5`, `Human`.

---

## 2026-05-12  Session — comprehensive cross-platform QA + production hotfixes

### 2026-05-12  ~11:00 ET  —  Claude Opus 4.7 (1M)  —  session-start

- **What:** Cross-platform QA walkthrough requested — drive iOS + Android + macOS simulators, file fixes for what's found.
- **Outcome target:** Surface real production bugs before any user hits them.

### 2026-05-12  ~14:30 ET  —  Claude Opus 4.7 (1M)  —  pr-merged  —  #69 fix(native): iOS Dynamic Island clearance

- **What:** `components/testing-banner.tsx` was missing `safe-area-inset-top`; the invite-only marquee ran under the Dynamic Island on iPhone 16 Pro.
- **PR / Linear:** [PR #69](https://github.com/mirror-factory/layers/pull/69) / [PROD-460](https://linear.app/mirror-factory/issue/PROD-460)
- **Why it matters:** First impression on every iOS user was the banner clipping into the camera notch.

### 2026-05-12  ~14:45 ET  —  Claude Opus 4.7 (1M)  —  prod-hotfix  —  #70 fix(cron): un-export Zod schemas from watchlist-tick route

- **What:** PR #65 (PROD-371) had exported `WatchlistTickResponseSchema` from `app/api/cron/watchlist-tick/route.ts`. Next.js 15 forbids that on `route.ts` files. `pnpm build` failed on every push for ~2 hours.
- **PR / Linear:** [PR #70](https://github.com/mirror-factory/layers/pull/70)
- **Why it matters:** Production deploys had been silently failing since #65 merged. The earlier PR #69 also never reached the edge until this fix landed.

### 2026-05-12  ~15:18 ET  —  Claude Opus 4.7 (1M)  —  pr-merged  —  #73 fix(public-nav): opaque sticky header on mobile

- **What:** `bg-[var(--bg-page)]/85 backdrop-blur-md` let bold headlines and `$30` pricing values bleed through the sticky nav during scroll on Pixel 7.
- **PR / Linear:** [PR #73](https://github.com/mirror-factory/layers/pull/73)
- **Why it matters:** Frosted-glass header was breaking on mobile where the strip is too narrow.

### 2026-05-12  ~15:32 ET  —  Claude Opus 4.7 (1M)  —  pr-merged  —  #74 fix(sign-in): use canonical support email

- **What:** Sign-in footnote linked users to `hello@layers.app` (orphan inbox) instead of `support@mirrorfactory.ai`.
- **PR / Linear:** [PR #74](https://github.com/mirror-factory/layers/pull/74)
- **Why it matters:** Anyone hitting a sign-in error and following the help link got a bounce.

### 2026-05-12  ~16:46 ET  —  Claude Opus 4.7 (1M)  —  prod-migration  —  4 migrations applied via Supabase MCP

- **What:** `00007_recordings_storage_bucket`, `00008_recipes`, `00009_meeting_user_notes`, `00010_onboarding_emails` had merged into `git` over the day but were never applied to the Audio Layer prod DB. `/api/account/recipes` had been returning 500 for every user.
- **Linear:** [PROD-483](https://linear.app/mirror-factory/issue/PROD-483) — process-gap ticket, owner:human, three concrete fix options listed.
- **Why it matters:** Production /api/account/recipes 500 since PR #58 (~11h). Recipes feature unreachable site-wide.

### 2026-05-12  ~17:40 ET  —  Claude Opus 4.7 (1M)  —  pr-merged  —  #78 fix(public-nav): auth-aware nav + redirect

- **What:** Two Linear tickets resolved: PROD-485 (PublicSiteNav showed anon links to signed-in users) + PROD-486 (`/sign-in` didn't redirect already-authed users).
- **PR / Linear:** [PR #78](https://github.com/mirror-factory/layers/pull/78) / [PROD-485](https://linear.app/mirror-factory/issue/PROD-485) [PROD-486](https://linear.app/mirror-factory/issue/PROD-486)
- **Why it matters:** Signed-in users had no path to /meetings; tapping "Sign in" while authed showed an empty form.

### 2026-05-12  ~18:55 ET  —  Claude Opus 4.7 (1M)  —  prod-incident → prod-hotfix  —  #80 anon sessions broke /sign-in for ALL users

- **What:** PR #78's `getCurrentUserId()` guard returned a non-null id for anonymous Supabase sessions (the site auto-creates one per visit). `/sign-in` returned 307 → /record for every visitor.
- **Window:** PR #78 merge (~19:30 UTC) → PR #80 merge (~22:55 UTC) ≈ **~90 min outage on auth entry**.
- **PR / Linear:** [PR #80](https://github.com/mirror-factory/layers/pull/80) / [PROD-487 urgent](https://linear.app/mirror-factory/issue/PROD-487)
- **Fix:** added `getCurrentSignedInUserId()` that excludes `user.is_anonymous`. Three call sites updated.
- **Why it matters:** Sign-in was unreachable in production. Followup: audit other call sites of `getCurrentUserId()` for the same confusion.

### 2026-05-12  ~19:05 ET  —  Claude Opus 4.7 (1M)  —  doc-shipped  —  Activity log + AGENTS.md contract

- **What:** Created `docs/ACTIVITY_LOG.md` (this file) + bound every agent (Claude / Codex / Cursor / human) to keep appending via a contract in `AGENTS.md`.
- **Why it matters:** Stops the "where are we at" question from requiring a full git-log + Linear sweep. Whoever asks reads this doc.

---

<!-- New entries below. Append, do not edit prior rows. -->

### 2026-05-12  ~19:15 ET  —  Claude Opus 4.7 (1M)  —  pr-merged  —  #81 docs(activity-log): contract + backfill

- **What:** Landed `docs/ACTIVITY_LOG.md` (this file) + `## Activity Log Contract` section in AGENTS.md. Backfilled all of today's session.
- **PR:** [PR #81](https://github.com/mirror-factory/layers/pull/81)
- **Why it matters:** From now on, "give me a rundown" is one-file. Every provider is bound by the contract.

### 2026-05-12  ~19:15 ET  —  Claude Opus 4.7 (1M)  —  session-checkpoint  —  rundown pushed to NTFY

- **What:** Pushed condensed rundown to NTFY topic `layers-mf-08ebf1d1` (msg id `d2uSyX3fYwlK`). Default action on "give me a rundown" requests going forward.
- **Why it matters:** User receives push notifications on phone/desktop and can scroll back through them historically.

### 2026-05-12  ~20:33 ET  —  Claude Opus 4.7 (1M)  —  prod-incident  —  /sign-in loop in Capacitor iOS

- **What:** While walking iOS authed surfaces I had set `CAPACITOR_SERVER_URL=https://layers.mirrorfactory.ai/sign-in` to land the app on the form. After a successful Google OAuth attempt the WebView reloaded from `server.url` and bounced back to /sign-in → /record → reload → loop.
- **User-visible:** Tapping "Continue with Google" looped infinitely.
- **Mitigation:** Reverted Capacitor's `server.url` to root, rebuilt + reinstalled. Loop gone.
- **Lesson:** Don't pin `server.url` to a non-root path for Capacitor sims — OAuth round-trip lands on a different path than what the WebView reloads to.

### 2026-05-12  ~20:38 ET  —  Claude Opus 4.7 (1M)  —  config-change  —  Maestro CLI installed

- **What:** `brew install --formula mobile-dev-inc/tap/maestro` (v2.5.1) — UI testing CLI for iOS sim. Replaces the gap where `xcrun simctl` has no `tap` subcommand.
- **Why it matters:** iOS sim now scriptable end-to-end (sign-in, navigation, screenshot). Mirrors Android's `adb shell input tap` capability.

### 2026-05-12  ~20:42 ET  —  Claude Opus 4.7 (1M)  —  session-checkpoint  —  iOS Capacitor authed walk done via Maestro

- **What:** Wrote two flows:
  - `tests/maestro/ios-signin-test-user.yml` — full sign-in drive (hamburger → Sign in → form fill → Enter to submit). Avoids `hideKeyboard` because it taps off-keyboard and accidentally hits the "Create an account" link.
  - `tests/maestro/ios-authed-walk.yml` — walks `/meetings`, `/chat`, `/settings`, `/profile` via `launchApp` between each (cleaner than tapping back-arrow).
- **Evidence:** 5 fresh iOS Capacitor screenshots in `docs/evidence/2026-05-12-walkthrough/ios-walk-*.png`. Profile page confirms test user UUID `d0b8989a-4cc0-4fe0-aa22-61952f6da63b` + email `qa-walkthrough-2026-05-12@mirrorfactory.ai` rendering authentically. PR #78 auth-aware nav fix verified live on iOS.
- **Why it matters:** Closes the iOS automation gap. Future QA passes don't need a human to drive the iPhone sim.

### 2026-05-12  ~21:05 ET  —  Claude Opus 4.7 (1M)  —  linear-filed  —  PROD-496 + 3 sub-issues for Brand Kit + Remotion + HTML-in-Canvas skill

- **What:** Goal: stand up a shareable Layers brand kit, a Remotion brand template, and a combined Claude skill for branded video work — all in one push. Created PROD-496 (parent, In Progress) + 3 sub-issues:
  - [PROD-497](https://linear.app/mirror-factory/issue/PROD-497) — Brand Foundation (narrative, design-kit.html, organic logo variant)
  - [PROD-498](https://linear.app/mirror-factory/issue/PROD-498) — HTML-in-Canvas playground
  - [PROD-499](https://linear.app/mirror-factory/issue/PROD-499) — Remotion brand template + combined skill
- **Linear:** [PROD-496](https://linear.app/mirror-factory/issue/PROD-496)
- **Why it matters:** Single tracked surface for the brand work — future "where's that brand kit?" / "where's the Remotion template?" lookups land on one ticket tree.

### 2026-05-12  ~21:35 ET  —  Claude Opus 4.7 (1M)  —  doc-shipped  —  Brand Narrative + Design Kit + Playground + Remotion Template + Combined Skill

- **What:** Single push delivering all of PROD-496:
  - `branding/BRAND_NARRATIVE.md` — 11-section voice + visual + narrative source of truth
  - `branding/design-kit.html` — self-contained shareable kit (tokens, fonts, three wave colors with live demo, current vs. proposed organic logo side-by-side for approval, voice do/don't, partner-logo gallery)
  - `branding/htmlcanvas-playground.html` — six live brand-narrative demos in stock Chrome (you-are-the-dot, magnifier, paper-grain stats, CRT terminal, organic-wave generator, context-flow with real LLM logos)
  - `remotion/scenes/brand-template/` — six-beat 40-second template (ColdOpen → Wedge → FaceToDot → Layers → ContextFlow → Outro) wired into `remotion/Root.tsx` as `BrandTemplate`
  - `.claude/skills/layers-brand-remotion/SKILL.md` — combined skill bundling brand voice + Layers Remotion patterns + Remotion `<HtmlInCanvas>` patterns with which-effect-for-which-narrative-beat guidance
- **Constraint honored:** new organic logo is approval-only — `components/layers-logo.tsx`, `components/top-bar.tsx`, and `remotion/components/LayersMark.tsx` are untouched. Other agent's iOS walkthrough surfaces left alone.
- **Verify:** `pnpm typecheck` clean.
- **How to view locally:**
  - Design kit: open `branding/design-kit.html` directly in a browser
  - Playground: open `branding/htmlcanvas-playground.html` directly in a browser
  - Remotion: `pnpm video:dev` (opens Studio; pick `BrandTemplate` from the sidebar)
  - Render a still: `pnpm exec remotion still BrandTemplate out/brand-template-cover.png --frame=480`
- **Linear:** [PROD-496](https://linear.app/mirror-factory/issue/PROD-496), [PROD-497](https://linear.app/mirror-factory/issue/PROD-497), [PROD-498](https://linear.app/mirror-factory/issue/PROD-498), [PROD-499](https://linear.app/mirror-factory/issue/PROD-499)
- **Why it matters:** First time the brand has a shareable, agent-readable source of truth. New skill means any future video / branded asset task picks up the voice + tokens + Remotion conventions without a human re-briefing.

### 2026-05-12  ~21:13 ET  —  Claude Opus 4.7 (1M)  —  prod-incident  —  Recording flow crashes on Stop (PROD-500)

- **What:** Maestro recording flow on iOS Capacitor (`tests/maestro/ios-record-meeting.yml`) drove Start → 26s wait → Stop. The Stop tap rendered a page-level error boundary: `Something broke. The page failed to render. Reference: 3452159959`.
- **Evidence:** `docs/evidence/2026-05-12-walkthrough/ios-rec-{01,02,03,04}*.png`
- **Linear:** [PROD-500](https://linear.app/mirror-factory/issue/PROD-500)
- **Why it matters:** 100% repro of the headline workflow failing. Likely empty-audio (sim has no mic) crashing the `finalize` route or the demo-meeting id mismatching the AssemblyAI handoff.

### 2026-05-12  ~21:21 ET  —  Claude Opus 4.7 (1M)  —  linear-filed  —  Cross-Platform QA suite (PROD-501 + 4 children)

- **What:** Built the master Linear QA tree per the user's spec — one parent + per-platform children, each with the full checkable checklist + platform-only extras (notifications, code-signing, deep-links, etc.).
- **Linear:**
  - Master [PROD-501](https://linear.app/mirror-factory/issue/PROD-501)
  - Web [PROD-502](https://linear.app/mirror-factory/issue/PROD-502)
  - iOS [PROD-503](https://linear.app/mirror-factory/issue/PROD-503)
  - Android [PROD-504](https://linear.app/mirror-factory/issue/PROD-504)
  - macOS [PROD-505](https://linear.app/mirror-factory/issue/PROD-505)
  - Windows (deferred) [PROD-506](https://linear.app/mirror-factory/issue/PROD-506)
- **Why it matters:** Replaces the ad-hoc walks with a structured rolling suite. Each row commented + ticked with screenshot + video proof. Pass-rate visible at the master level.

### 2026-05-12  ~21:30 ET  —  Claude Opus 4.7 (1M)  —  doc-shipped  —  `.claude/skills/cross-platform-qa/SKILL.md`

- **What:** Dual-format playbook — Section 1 is the agent procedure (machine-runnable, references Maestro flows + adb commands + claude-in-chrome MCP); Section 2 is the human runbook. Both reference PROD-501.
- **Why it matters:** The next agent (Codex / Cursor / future Claude) or human tester opens this and can run the suite without re-deriving the setup.
