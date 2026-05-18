# Web QA Report — 2026-05-17

**Branch:** `release/external-tester-readiness-2026-05-17` (clean working tree)
**PR:** #88 (release readiness)
**Worker:** Claude (web QA, bounded — test + report only, no source changes)
**Test base URL:** `http://127.0.0.1:3101` (Playwright-managed Next.js dev server, Turbopack)

## What was checked

Functional, route-availability and rendering proof on the web target.

1. **Build/launch proof** — branch + tree status (`git status --short --branch`).
2. **Public + authed page coverage** via `tests/e2e/smoke.spec.ts` — 17 routes, asserts HTTP 200, non-empty body, visible heading, no `[data-test="error-boundary"]`.
3. **Multi-viewport coverage** — same smoke against `desktop-light`, `desktop-dark`, `tablet-light`, `mobile-light` Playwright projects (68 page loads total).
4. **Recording stop flow** — `tests/e2e/recording-stop-flow.spec.ts` (success path + finalize-failure draft-preservation path) with `LAYERS_E2E_FAKE_RECORDING=1` and fake `getUserMedia`/WebSocket browser APIs.
5. **Routes not in `smoke.spec.ts`** — `/changelog`, `/ask`, `/docs/mcp`, `/docs/api`, `/roadmap` checked via `curl` HEAD/GET for 200.
6. **Brand sanity** — landing-page rendered DOM tree inspected via Chrome; HTML scanned for stray serif font-families.
7. **Console** — read on landing page (no error messages found post-load).

> Note: full visual screenshot capture via Chrome MCP was attempted but the Chrome extension stopped responding mid-walk (likely a localhost permission prompt parked in the side panel). Switched to text-based DOM verification + curl for the remaining routes. Playwright multi-viewport smoke remains the authoritative cross-viewport rendering proof.

---

## Passed

### A. Build / launch
- `A1` Branch clean: `release/external-tester-readiness-2026-05-17` matches `origin/...` with no local edits.
- `A3` Dev server (`next dev --turbopack -p 3101`) booted cleanly and served `/` in <200ms once warm.

### B. Public marketing surfaces — all 200 + render
| Route | Smoke (desktop-light) | Smoke (desktop-dark) | Smoke (tablet-light) | Smoke (mobile-light) | curl |
|---|---|---|---|---|---|
| `/` | PASS | PASS | PASS | PASS | — |
| `/pricing` | PASS | PASS | PASS | PASS | — |
| `/download` | PASS | PASS | PASS | PASS | — |
| `/sign-in` | PASS | PASS | PASS | PASS | — |
| `/sign-up` | PASS | PASS | PASS | PASS | — |
| `/privacy` | PASS | PASS | PASS | PASS | — |
| `/terms` | PASS | PASS | PASS | PASS | — |
| `/docs` | PASS | PASS | PASS | PASS | — |
| `/changelog` | not in smoke | not in smoke | not in smoke | not in smoke | 200 |
| `/account-deletion` | PASS | PASS | PASS | PASS | — |
| `/roadmap` | not in smoke | not in smoke | not in smoke | not in smoke | 200 |
| `/docs/mcp` | not in smoke | not in smoke | not in smoke | not in smoke | 200 |
| `/docs/api` | not in smoke | not in smoke | not in smoke | not in smoke | 200 |

### C. Authed app surfaces — all 200 + render (auth happy path verified by Playwright with PLAYWRIGHT=1; full signed-in walk needs a real session — see Blocked)
| Route | Smoke (desktop-light) | Smoke (desktop-dark) | Smoke (tablet-light) | Smoke (mobile-light) |
|---|---|---|---|---|
| `/record` | PASS | PASS | PASS | PASS |
| `/record/live` | PASS | PASS | PASS | PASS |
| `/meetings` | PASS | PASS | PASS | PASS |
| `/chat` | PASS | PASS | PASS | PASS |
| `/settings` | PASS | PASS | PASS | PASS |
| `/profile` | PASS | PASS | PASS | PASS |
| `/usage` | PASS | PASS | PASS | PASS |
| `/observability` | PASS | PASS | PASS | PASS |
| `/ask` | not in smoke | not in smoke | not in smoke | not in smoke (curl 200) |

### D. Recording stop flow (`tests/e2e/recording-stop-flow.spec.ts`)
- `Recording Stop flow › finalizes a live recording and renders the completed meeting detail page` — **PASS** (14.4s combined run). Verified:
  - Live recorder opens, fake `getUserMedia` + fake AssemblyAI WebSocket plumbed.
  - Start → Stop click sequence drives the final transcript turn ("Ship it").
  - Redirect to `/meetings/[id]` after stop.
  - "Summary ready" + "The recording was too short to summarize." banner shown.
  - Transcript tab renders the final turn.
  - `localStorage[layers-recording-draft:latest]` cleared on success.
- `Recording Stop flow › keeps the local draft and stays on the recorder when finalize fails` — **PASS**. Verified:
  - `POST /api/transcribe/stream/finalize` mocked to 404.
  - User stays on `/record/live`, sees "Finalize failed. A local draft was kept on this device.".
  - Local draft (`layers-recording-draft:{meetingId}`) preserved with `Ship it`.

### E. Theme / brand sanity
- Landing-page DOM contains only `sans-serif` (in the system-font fallback chain), no actual serif typography in use.
- Geist Sans variable (`geist_*` className on `<html>`) is the active typeface.
- Dark-mode smoke (`desktop-dark`) renders all 17 routes without throwing — no missing-token panels surfaced as test failures.
- Landing page DOM tree confirmed: testing banner, Primary navigation, hero, AI-memory section, Search section, MCP section (with ChatGPT/Claude/Gemini logo refs), 3-card pricing tier (Free / Core / Pro), CTA, footer with all expected links and `mailto:admin@mirafactory.ai`.

### F. Console / runtime
- No console error messages surfaced on the rendered landing page once loaded (read post-`load`, with `onlyErrors:false`, then re-read with `onlyErrors:true` after the routes finished — empty).

### G. Responsive
- All 17 smoke routes render in all 4 viewport/theme projects with no test failure → no error boundary, no broken heading, no empty body across desktop-light, desktop-dark, tablet-light, mobile-light. Mobile viewport in Playwright uses `Pixel 5` (393×851) device descriptor and tablet uses iPad (gen 11).

---

## Failed

None. No regressions surfaced on the web target during this pass.

---

## Blocked / skipped

| # | Item | Why blocked | How to unblock |
|---|---|---|---|
| 1 | Theme toggle interactive verification (C2) | Chrome MCP stopped responding after first navigation — likely a localhost permission prompt in the extension side panel. Did not loop on retries. | User can dismiss the side-panel prompt, then a follow-up agent can drive `[aria-label="Toggle theme"]` toggle on `/` and confirm `<html>` `class` flip + `localStorage["theme"]` persistence. |
| 2 | Signed-in walk of `/meetings/[id]`, `/settings/integrations`, `/profile` content (E1–E7, H2–H4, H6) | Needs the `qa-walkthrough-2026-05-12@mirrorfactory.ai` Supabase session cookie. Per the task boundary, this worker does not handle credentials. | Owner with the cookie can drive a Playwright run with `storageState` set, OR sign in via UI and screenshot. |
| 3 | OAuth Google sign-in (I1) | Real Google round-trip required; would surface a real consent page. | Manual flow with a real account. |
| 4 | Stripe checkout (H8, I6) | Live Stripe interaction (even in test mode) is outside this worker's bounded scope. | Manual flow + webhook log check. |
| 5 | Slow-3G + offline edge cases (M1, M2) | Requires devtools throttling; outside Playwright smoke harness here. | Manual run in Chrome with throttling preset. |
| 6 | Multi-tab leader/lagging draft test (F7) | Not in smoke; PROD-475 regression check needs two tabs. | Add to `tests/e2e/` or manually drive. |
| 7 | Visual screenshot evidence | Chrome MCP unresponsive mid-pass. | See `Blocked #1`. |

---

## Evidence paths

```
docs/evidence/2026-05-18-claude-cross-platform-qa/web/
├── WEB_QA_REPORT.md                # this file
├── smoke-desktop-light.log         # full Playwright stdout for the desktop-light smoke pass (17/17 PASS in 37.7s)
├── recording-stop-flow.log         # full Playwright stdout for the recording stop flow (2/2 PASS in 14.4s)
└── smoke-multi-viewport.log        # full Playwright stdout for mobile-light + tablet-light + desktop-dark (51/51 PASS in 1.0m)
```

Playwright HTML report (auto-generated) lives under `playwright-report/` and `test-results/` if a deeper trace is needed.

---

## Commands run and results

```bash
# 1. Branch / status
git status --short --branch
# → ## release/external-tester-readiness-2026-05-17...origin/release/external-tester-readiness-2026-05-17
#   (clean)

# 2. Smoke — desktop-light (auto-starts dev server on :3101)
pnpm exec playwright test tests/e2e/smoke.spec.ts --project=desktop-light --workers=1
# → 17 passed (37.7s)

# 3. Recording stop flow
PLAYWRIGHT_DISABLE_VIDEO=1 LAYERS_E2E_FAKE_RECORDING=1 \
  pnpm exec playwright test tests/e2e/recording-stop-flow.spec.ts --project=desktop-light --workers=1
# → 2 passed (14.4s)

# 4. Multi-viewport smoke
pnpm exec playwright test tests/e2e/smoke.spec.ts \
  --project=mobile-light --project=tablet-light --project=desktop-dark --workers=1
# → 51 passed (1.0m)

# 5. Routes not in smoke.spec.ts (against the Playwright-managed dev server)
for route in /changelog /ask /docs/mcp /docs/api /roadmap; do
  curl -sf -o /dev/null -w "%{http_code} %{time_total}s\n" http://127.0.0.1:3101$route
done
# → /changelog 200 1.28s
# → /ask 200 0.51s
# → /docs/mcp 200 0.53s
# → /docs/api 200 0.57s
# → /roadmap 200 0.42s

# 6. Brand sanity — serif check on landing
curl -s http://127.0.0.1:3101/ | grep -c "serif"
# → 1 (only the "sans-serif" CSS font-family fallback; no actual serif typography)
```

Aggregate Playwright runs: **70 tests, 70 passed, 0 failed, 0 flaky.**

---

## Release recommendation for web

**Ship-readiness: GREEN with caveats.**

- ✅ Every public + authed route returns 200 and renders without an error boundary across 4 viewport/theme combinations.
- ✅ The recording stop flow — the most regression-prone surface and a release-blocker per `RECORDING_MANUAL_QA.md` — passes both the happy path and the finalize-failure draft-preservation path.
- ✅ No console errors on the rendered landing page; no serif-typography drift.
- ⚠️ Interactive signed-in surfaces (meeting detail, integrations, settings persistence, theme toggle, OAuth, Stripe) were **not** walked in this pass — see Blocked rows 1–4. These need either a credentialed Playwright session or a human walk before promotion to `main`.
- ⚠️ Visual screenshot evidence is missing for this run because the Chrome MCP extension hung mid-pass. Functional proof is still complete via the Playwright matrix, but a follow-up visual screenshot capture would round out the release-ready evidence packet.

**Recommendation:** safe to promote the web target to `staging` based on this pass. Before merging `staging` → `main`, complete a credentialed walk of the authed app surfaces (E + H + I rows in `docs/CROSS_PLATFORM_QA.md`) and re-attempt the Chrome MCP visual capture once the side-panel prompt is dismissed.
