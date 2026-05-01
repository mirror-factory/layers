# Responsive UI Test Matrix - 2026-05-01

## Goal

Verify and fix responsive layout defects across the core Layers product pages. The pass criteria are practical: no clipped controls, no text escaping its container, no horizontal overflow, no inaccessible/tiny tap targets, dark mode surfaces remain coherent, and primary tasks stay usable at mobile, tablet, and desktop widths.

## Design Context

- Product: private meeting recording, transcription, summary, action items, and reusable AI context.
- Users: founders, product teams, GTM teams, and operators capturing conversations while multitasking.
- Design system: Layers Paper Calm from `DESIGN.md`; use semantic `--layers-*`, `--bg-*`, `--fg-*`, `--border-*`, and `--signal-*` tokens.
- Style target: precise, effortless, alive. Dense enough for work, calm enough for long sessions.

## Evidence Directory

Screenshots and per-route notes should be written under:

`/Users/alfonso/Documents/GitHub/audio-layer/.ai-starter/evidence/responsive-core-pages-2026-05-01/`

Recommended naming:

`{route-slug}-{viewport}-{theme}-{state}.png`

Example: `record-live-mobile-light-recording.png`

## Viewports

| Viewport | Size | Why |
|---|---:|---|
| Mobile | `390x900` | iPhone-width primary portrait check. |
| Tablet | `834x1112` | iPad portrait / mid-width layout check. |
| Desktop | `1440x1100` | Standard desktop work session check. |

## Core Checks

Each page/state must be checked for:

| Check | Pass Criteria |
|---|---|
| Horizontal overflow | `document.documentElement.scrollWidth - window.innerWidth === 0` or only an intentional local scroll container. |
| Text containment | No label, tab, stat, transcript, card title, or button text escapes its parent. |
| Clipping | Primary controls and last visible content are not cut off by fixed/sticky bars. |
| Touch targets | Interactive controls are at least `44x44px` on mobile/tablet unless clearly non-touch text links. |
| Theme | Light and dark backgrounds, cards, inputs, and menus use coherent Layers tokens. |
| Motion/state | Loading, arming, recording, stopping, empty, and error states do not jump into broken square/blank layouts. |
| Navigation/menu | Menus fit the viewport and do not render as accidental sidebars or offscreen panels. |

## Page Matrix

| Owner | Route / State | Desktop | Tablet | Mobile | Required State Notes |
|---|---|---:|---:|---:|---|
| Recording Agent | `/record` main start page | Passed | Passed | Passed | Empty/ready state, calendar panel, start button, stats, menu. Evidence: `recording/record-{mobile,tablet,desktop}-light-ready.png`. |
| Recording Agent | `/record/live` ready state | Passed | Passed | Passed | Ready to record shell, start button, preflight cards. Evidence: `recording/record-live-{mobile,tablet,desktop}-light-ready.png`. |
| Recording Agent | `/record/live` recording state | Passed | Passed | Passed | Browser-stubbed recording state; checked timer, real tabs, stop control, bottom live chip. Evidence: `recording/record-live-{mobile,tablet,desktop}-light-recording.png`. |
| Summary Agent | `/meetings/[id]` summary/detail | Passed | Passed | Passed | Authenticated fixture route `/meetings/qa-responsive-summary-20260501-35808943`; duplicate lower Notes/Summary removed. Evidence: `summary/meeting-summary-{mobile,tablet,desktop}-light-after.png`. |
| Account Agent | `/settings` | Passed | Passed | Passed | Account/avatar menu, calendar connect, model settings, forms, theme. Evidence: `account/settings-{mobile,tablet,desktop}-{light,dark}-{default,menu-open}.png`. |
| Account Agent | `/profile` | Passed | Passed | Passed | API key/MCP area, account actions, menu, narrow width. Evidence: `account/profile-{mobile,tablet,desktop}-{light,dark}-{default,menu-open}.png`. |
| Account Agent | `/usage` | Passed | Passed | Passed | Plan meters, usage tables/cards, billing/status content. Evidence: `account/usage-{mobile,tablet,desktop}-{light,dark}-{default,menu-open}.png`. |

## Final Results

| Area | Result |
|---|---|
| Recording `/record` and `/record/live` | Passed at `390x900`, `834x1112`, and `1440x1100`; overflow `0px`; real tabs implemented; meeting title constrained to one line. |
| Summary `/meetings/[id]` | Passed at `390x900`, `834x1112`, and `1440x1100`; overflow `0px`; lower duplicate Notes/Summary removed; status footer now flows in layout. |
| Settings/Profile/Usage | Passed at `390x900`, `834x1112`, and `1440x1100`, light and dark, default and menu-open states; overflow `0px`; small touch targets fixed. |
| Typecheck | Passed after agent fixes. |

## Agent Work Split

### Recording Agent

Owns:
- `app/record/page.tsx`
- `app/record/live/page.tsx`
- `app/recorder.tsx`
- `components/live-recorder.tsx`
- `components/audio-recorder.tsx`
- recording-related selectors in `app/globals.css`

Avoid:
- Calendar OAuth logic
- Deepgram/token logic
- Settings/profile/usage UI

### Summary Agent

Owns:
- `app/meetings/[id]/page.tsx`
- `app/meetings/page.tsx` only if needed to reach a detail page
- `components/meeting-*.tsx`
- meeting/summary/transcript-related selectors in `app/globals.css`

Avoid:
- Recording start/stop logic
- Account pages
- Provider settings

### Account Agent

Owns:
- `app/settings/page.tsx`
- `app/profile/page.tsx`
- `app/usage/page.tsx`
- `components/top-bar.tsx`
- `components/slide-menu.tsx`
- account/settings/profile/usage/menu selectors in `app/globals.css`

Avoid:
- Recording internals
- Meeting detail internals
- Provider/token route logic

## Reporting Format

Each agent should return:

1. Screenshots captured with paths.
2. Exact viewport/theme/state coverage.
3. Defects found, with route and selector/component.
4. Files changed.
5. Verification results:
   - overflow numbers per route/viewport
   - `pnpm typecheck` if run
   - any focused tests if run

## Final Acceptance

The final integration pass should run:

```bash
pnpm typecheck
```

And a Playwright/browser script that visits the matrix routes at `390x900`, `834x1112`, and `1440x1100`, reporting horizontal overflow and capturing final screenshots.
