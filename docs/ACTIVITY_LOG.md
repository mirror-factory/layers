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
