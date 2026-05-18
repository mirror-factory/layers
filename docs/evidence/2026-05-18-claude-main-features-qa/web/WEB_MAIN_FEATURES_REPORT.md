# Web — Main Features QA Report (2026-05-18)

**Worker:** Claude (bounded — test + report only, no source changes, no push/merge/publish)
**Branch (local checkout):** `release/external-tester-readiness-2026-05-17` @ `1dda53c`
**PR:** [#88 Release readiness QA and native build fixes](https://github.com/mirror-factory/pull/88)
**Test targets used:**
- **Recording proof:** local Playwright managed server (Next.js dev on 3xxx) — **FAKE recording mode**.
- **Live UI walk:** production `https://layers.mirrorfactory.ai/` (PR #88 Vercel preview `audio-layer-git-releas-3683c2-…vercel.app` returned **HTTP 401** — gated, cannot reach without preview-bypass cookie).
**Signed-in QA user:** `qa-walkthrough-2026-05-12@mirrorfactory.ai` (`d0b8989a-4cc0-4fe0-aa22-61952f6da63b`) — Free plan, 2 meetings, 1 minute transcribed, $0.0043 STT spend. Password not printed.
**Browser:** Chrome via `claude-in-chrome` MCP (visible/headed window, signed-in session already present).

> **Headline finding:** Meeting detail page renders **"Something broke. The page failed to render."** for *every* meeting on this production account. Reproduces on both meetings (`11ebab80-…` and `14ce83d3-…`) with identical error reference. Server Components render error logged. **Recommend BLOCKING external-tester rollout until /meetings/[id] renders for at least the QA seed account.**

---

## 1. Commands run

```bash
# 1. Probe targets
curl -sS -o /dev/null -w "%{http_code}\n" -L https://layers.mirrorfactory.ai/
#   -> 200 (production reachable)
curl -sS -o /dev/null -w "%{http_code}\n" -L https://audio-layer-git-releas-3683c2-mirror-factorys-projects-836be98a.vercel.app/
#   -> 401 (Vercel preview gated)

# 2. Recording stop-flow Playwright proof (FAKE — gated by LAYERS_E2E_FAKE_RECORDING=1)
PLAYWRIGHT_DISABLE_VIDEO=1 pnpm exec playwright test tests/e2e/recording-stop-flow.spec.ts --workers=1 --reporter=line
#   -> 12 passed (43.9s) across mobile/tablet/desktop × light/dark

# 3. Live UI walk via Chrome MCP against production (read-only navigations, no live AI calls)
#    Routes visited:
#      /                       (anonymous-style landing, served with signed-in nav)
#      /sign-in                (redirected to /record when already signed in — PR#78 check passes)
#      /record
#      /record/live
#      /meetings
#      /meetings/<id> × 2      (BOTH FAILED — see §3 Failures)
#      /chat
#      /ask
#      /search
#      /settings
#      /settings/integrations
#      /settings/recipes
#      /profile
#      /usage
```

Console-error reads were issued per route via `read_console_messages onlyErrors:true clear:true`.

---

## 2. Pass

### A. Authentication / signed-in nav state
- **`/sign-in` redirected to `/record`** when already signed in — PR #78 redirect contract holds (C1b).
- **`/profile`** shows correct identity for the QA user: email `qa-walkthrough-2026-05-12@mirrorfactory.ai`, user id `d0b8989a-4cc0-4fe0-aa22-61952f6da63b`, plan `Free`. Sign-out + Delete-account CTAs render.
- **Landing `/`** with active session renders authed top-nav: `Meetings · Chat · Settings · Profile` (+ theme toggle + account avatar).
- **Account menu chip** "AM" renders top-right on every authed route.

### B. Recording — stop flow (FAKE proof)
- `tests/e2e/recording-stop-flow.spec.ts`: **12 / 12 passed** across `mobile-light`, `mobile-dark`, `tablet-light`, `tablet-dark`, `desktop-light`, `desktop-dark`.
  - Success path: Start → Stop → finalize → redirect to `/meetings/[id]` → final transcript turn ("Ship it") visible → local draft cleared.
  - Failure-resilience path: finalize 404 → user stays on `/record/live` → "Finalize failed. A local draft was kept on this device." → `layers-recording-draft:{meetingId}` preserved.
- **This is FAKE recording proof.** Real getUserMedia, AssemblyAI WS, AudioWorklet are stubbed in the spec. Evidence log: `logs/recording-stop-flow.log`.
- **No long cloud recording attempted** (cost-aware).

### C. /record (live UI)
- Renders cleanly: Layers logo, theme toggle, account avatar, "Recent recordings" panel (2 entries), date/clock, organic wave visualization, "Tap to start taking notes" + Start-recording CTA, Calendar-context "Coming soon" card, "MCP READY — Connect your AI tools" card, floating Ask pill.
- Console: only an extension-origin error (`chrome-extension://fjnbnpbmkenffdnngjfgmeleoegfcffe contentYt.js — NotFoundError removeChild`). **Not a Layers error.**

### D. /record/live (live UI)
- Renders with demo session "Product planning session / Layers roadmap" (`Connected to calendar` pill, Date `Tuesday, April 28`, READY pill, Start-recording CTA).
- Tabs render: `Transcript | Key points (4) | Ask | Actions (3)`. Live-summary block populated. Session totals 6 segments / 76 words / 4 points / 3 actions. Live-transcript shows 5 timestamped turns.
- No console errors on load.
- ⚠️ **Cosmetic note:** account avatar initials displayed are `LM` on `/record/live` but `AM` on every other authed route. May be the meeting/session attendee avatar rather than the account avatar — flag for visual review but not a blocker.

### E. /meetings (list)
- "Find the right call in seconds." hero, **New recording** CTA, stats `2 saved / 2 complete / 2 minutes`, search bar, Archive section with 2 "Untitled recording" rows (5/13/2026 · 1 min each).
- Floating Ask pill present.
- No console errors.

### F. /chat
- Empty-state renders: speech-bubble icon, "Ask anything from your meeting library.", italic example query, 4 suggested-query chips (`What did I commit to this week?`, `Recurring blockers`, `Customers asking about pricing`, `Decisions across last 5 meetings`).
- Bottom input `Ask about your meetings…` + disabled send icon.
- **Did not fire a live AI call** (cost-aware).
- No console errors.

### G. /ask
- Renders "Meeting memory / Ask or find anything." headline with `Ask` / `Find` segmented toggle.
- Empty-state body, 3 example chips, Quick-finds panel (`open action items`, `pricing decisions`, `customer objections`, `next follow-ups`).
- Bottom textarea + send button.
- **Did not fire a live AI call** (cost-aware).
- No console errors.

### H. /search
- "Find anything from a meeting." headline + description, search box with Search button, "Search your meeting memory" suggestion card with 4 quick chips.
- No console errors.

### I. /settings
- **Model Preferences** card with three dropdowns:
  - Summary/Intake Model — selected: `GPT-5.4 Nano`, options include GPT-5.4 family, GPT-4.1 family, o4-mini, Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5, Gemini 2.5 Pro/Flash/Flash-Lite/2.0 Flash.
  - Batch Speech Model — selected: `Universal-3 Pro (AssemblyAI)`; alt: Universal-2.
  - Streaming Speech Model — selected: `Universal Streaming Multilingual (AssemblyAI)`; many alt options including Deepgram (Nova-3 Mono/Multi, Flux).
- **Recording Reminders** card (No reminder set / 5m / 15m / 30m).
- **Integrations** card (MCP URL placeholder, Calendar `COMING SOON`, Settings sync `COMING SOON`).
- **Webhooks** card with `Meeting completed` / `Recording failed` tabs, empty state.
- No console errors.

### J. /settings/integrations
- **Connected apps** — "No connected apps yet." with copy linking to `/record` for MCP setup.
- **API keys** — "New API key" composer (label + Generate key) and explanation that OAuth + DCR is the default.
- No console errors.

### K. /settings/recipes
- "Save prompts you use often. Type `/` in any chat to insert one." copy.
- "New recipe" composer (name + prompt textarea + Save).
- "Your recipes" — one existing recipe `Sales discovery` ("Use this meeting to create a sales discovery brief with pain points, budget signals, decision makers, objections, next steps, risks, and transcript segment citations.").
- No console errors.

### L. /profile
- See §2.A above. Renders all expected fields + Sign Out + Delete Account.
- No console errors.

### M. /usage
- Cost Tracking dashboard: `TOTAL MEETINGS 2`, `MINUTES TRANSCRIBED 1`, `STT SPEND $0.0043`, `LLM SPEND $0.00`, `SUBSCRIPTION Free`, `MONTHLY MINUTES 1 / 120 min used` (119 remaining), `FREE TIER QUOTA 2 / 25 meetings used`.
- No console errors.

### N. Theme toggle + persistence (C2)
- `light → dark` toggle via header sun/moon icon (top-right) flips `<html>` class from `… light` → `… dark` and writes `localStorage.theme=dark`.
- Reload + navigation to a different authed route preserves `dark` class and `localStorage.theme`. Toggle back to light works.
- **One UX note:** the icon's hit target is small and only the inner area registers — clicking via accessibility-tree `ref` (which targets a wrapper) did not register; click on the visible icon coordinates did. Worth checking the button-vs-wrapper a11y target on tablet/mobile, but the toggle itself works.

### O. Console / runtime errors on main authed routes
- Only one non-Layers extension error observed: `chrome-extension://fjnbnpbmkenffdnngjfgmeleoegfcffe contentYt.js — NotFoundError removeChild` (a YouTube-related browser extension installed in the host Chrome, not a Layers issue).
- No Layers-origin runtime errors on `/record`, `/record/live`, `/meetings`, `/chat`, `/ask`, `/search`, `/settings`, `/settings/integrations`, `/settings/recipes`, `/profile`, `/usage`.

---

## 3. Failures

### F1 — /meetings/[id] crashes for every meeting on production (BLOCKER)

**Affected route:** `/meetings/<uuid>` for any meeting on this account.
**Affected URLs verified:**
- `https://layers.mirrorfactory.ai/meetings/11ebab80-7176-43e6-a83a-e0f16821773d`
- `https://layers.mirrorfactory.ai/meetings/14ce83d3-f885-44dc-9863-6cabc2d5d2c0`

**Symptom:** Page renders only the framework error boundary:
```
Something broke
The page failed to render. The error has been logged.
Reference: 3452159959
Try again
```
Same reference ID on both meetings — looks like a stable digest from a single underlying server-component throw, not a per-record issue.

**Console (browser side):**
```
[ERROR] Error: An error occurred in the Server Components render. The specific message is
        omitted in production builds to avoid leaking sensitive details. A digest property
        is included on this error instance which may provide additional details about the
        nature of the error.
[ERROR] [route-error] Object
```

**Why it matters:**
- This is the canonical post-recording landing surface. The recording stop-flow test (§2.B) asserts a redirect to `/meetings/[id]` after stop — the FAKE proof passes because it asserts against the Playwright-managed dev server, but the **same surface throws in production** for at least the QA seed account.
- Cross-platform QA on 2026-05-12 already had `E2 /meetings/[id] — not walked (test user has no meetings yet)` as a `❓`. Now that the test user has 2 meetings, the route fails.
- External testers landing on a completed recording will see only "Something broke."

**Recommended next steps (not done by this worker):**
1. Pull the recent server logs by error digest (or by Reference ID `3452159959`) — production digest mapping should be available in Sentry / Langfuse / Vercel function logs.
2. Add a Playwright e2e that signs in as the QA user and asserts `/meetings/<seed-id>` returns 200 + renders the transcript/summary tabs — current `recording-stop-flow.spec.ts` only covers the just-finalized flow against the local dev server, not the post-load path against a real persisted meeting.
3. Block external-tester rollout on this.

---

## 4. Blocked / not-attempted (with reasons)

| # | Item | Reason | How to unblock |
|---|---|---|---|
| B1 | PR #88 Vercel preview UI walk | Preview returned HTTP 401 — gated behind Vercel auth/team-only access | Either disable preview protection on `audio-layer` project, or run the same walk after PR merges to `development` (which would deploy to `dev.layers.mirrorfactory.ai`) |
| B2 | Live recording UI (real `getUserMedia` + AssemblyAI capture) | Out of scope — task explicitly requested "fake recording" Playwright proof + UI-only manual check; long cloud recording is cost-bearing | Per-platform Recording Manual QA matrix (`docs/RECORDING_MANUAL_QA.md`) — already partially walked on 2026-05-17 for Android/macOS/iOS |
| B3 | /chat, /ask live AI streaming response | Cost-aware: would consume LLM tokens against the user's plan | Either mock or run inside a CI budget |
| B4 | Stripe checkout / upgrade flow | Out of scope of "main features" QA; live payment surface | Manual flow with Stripe test cards |
| B5 | Google OAuth round-trip (`/sign-in` Google button) | Real Google consent required; user already signed in via stored session | Sign out + Google OAuth from a clean browser profile |
| B6 | Native responsive (in-Chrome viewport resize) | `claude-in-chrome` `resize_window` resizes the OS window but the page viewport stays pinned at `innerWidth: 1280` — viewport meta-overrides the layout never picks up the new size, so the layout in the screenshot doesn't change | Use Playwright projects (already done yesterday — see `logs/smoke-multi-viewport-prior.log`: **51/51 passed across desktop-light / desktop-dark / tablet-light / mobile-light**) for cross-viewport rendering proof |
| B7 | /admin/pricing, /observability content audit | Out of scope — main features only | Separate admin walk |

---

## 5. Evidence paths

```
docs/evidence/2026-05-18-claude-main-features-qa/web/
├── WEB_MAIN_FEATURES_REPORT.md                  (this file)
├── logs/
│   ├── recording-stop-flow.log                  (full Playwright stdout, 12/12 passed, FAKE recording)
│   └── smoke-multi-viewport-prior.log           (51/51 from 2026-05-17 multi-viewport pass — copied for context)
└── screens/                                     (empty — Chrome MCP screenshots are inline-only; see report body for each route's visual confirmation)
```

Visual evidence for each route was captured as inline screenshots in the QA conversation (Chrome MCP returned 1280×661 JPEGs per `computer screenshot`). The report body above describes what each screenshot showed; the conversation transcript holds the images themselves.

---

## 6. Cross-reference

- Identical-day cross-platform QA: `docs/evidence/2026-05-18-claude-cross-platform-qa/web/WEB_QA_REPORT.md` covered route 200s and multi-viewport rendering against localhost. This pass covers **signed-in feature behavior against production**.
- The 2026-05-17 pass listed `E2 /meetings/[id] — not walked (test user has no meetings yet)`. That row is now `🔴` for web — see §3 F1.

---

## 7. Release recommendation

**RELEASE STATUS: BLOCKED for broad external-tester rollout. SAFE for internal alpha walkthrough.**

| Feature | Status |
|---|---|
| Sign in / signed-in nav | ✅ Pass |
| /record live UI | ✅ Pass |
| /record/live live UI | ✅ Pass (cosmetic `LM` vs `AM` avatar note) |
| Recording stop flow (fake) | ✅ Pass (12/12 cross-viewport) |
| Recording stop flow (real cloud) | ⏭️ Not attempted (cost-aware) |
| /meetings list | ✅ Pass |
| **/meetings/[id] detail render** | 🔴 **FAIL — Server Components render error on every meeting** |
| /chat | ✅ Pass (UI; live AI not exercised) |
| /ask | ✅ Pass (UI; live AI not exercised) |
| /search | ✅ Pass (UI) |
| /settings | ✅ Pass |
| /settings/integrations | ✅ Pass |
| /settings/recipes | ✅ Pass |
| /profile | ✅ Pass |
| /usage | ✅ Pass |
| Theme persistence (signed in) | ✅ Pass |
| Responsive | ✅ Pass via prior Playwright multi-viewport (51/51); ⚠️ in-browser resize not workable via Chrome MCP |
| Browser console errors | ✅ Pass (no Layers-origin errors on any happy-path route; the only error was on the BROKEN meeting detail route) |

**Recommendation:** Do not promote to external testers until F1 is resolved and a Playwright proof asserts authed `/meetings/<seed>` renders 200 + transcript. Internal alpha already-signed-in users will hit the same crash on any saved meeting, so even alpha-only users should be warned until F1 lands.
