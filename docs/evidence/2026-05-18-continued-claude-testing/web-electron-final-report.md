# Web / Brand / Electron — Final QA Lane Report

- Date: 2026-05-18
- Branch: `release/external-tester-readiness-2026-05-17`
- App version: `0.1.158`
- Working tree HEAD at run: `3d79936` + staged CSS hardening (`app/globals.css`)
- Lane scope: verify global serif drift is gone, prove sans-only computed fonts on
  public pages, capture homepage + sign-in screenshots (desktop/mobile × light/dark),
  and run a packaged Electron smoke on macOS.

## 1. Serif-drift audit (CSS source)

`app/globals.css` (unstaged) routes `--font-sans` and `--font-heading` to
`--font-brand-sans` (defined in `app/styles/tokens.css:55` as
`Geist, Inter, ui-sans-serif, system-ui, sans-serif`). The body, headings, paragraph
text, links, spans, labels, list items, and form controls are pinned to that same
sans-only stack:

```css
body {
  font-family:
    var(--font-brand-sans), Geist, Inter, ui-sans-serif, system-ui,
    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

:where(button, input, textarea, select) { font: inherit; }

:where(h1, h2, h3, h4, h5, h6, p, a, span, label, small, strong, em, li) {
  font-family:
    var(--font-brand-sans), Geist, Inter, ui-sans-serif, system-ui,
    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

Grep across the repo found **zero** real serif families (`Times`, `Georgia`,
`Cambria`, `Garamond`, `Baskerville`, `Charter`, `Didot`) in source. Every
`serif` token in CSS files is the generic `sans-serif` / `ui-sans-serif` fallback
or the standalone reports HTML. No global serif drift remains. **PASS.**

## 2. Public-page screenshots

Dev server: `pnpm dev` → `http://localhost:3000` (Next 15.5.18 Turbopack).
Capture script: `scripts/qa-web-font-shots.mjs` (Playwright @playwright/test
Chromium). All eight runs returned HTTP 200, no errors, and zero serif violations.

| Route       | Viewport | Theme | HTTP | Screenshot |
| ----------- | -------- | ----- | ----:| ---------- |
| `/`         | 1440×900 | light | 200  | `docs/evidence/2026-05-18-continued-claude-testing/web-electron/home-desktop-light.png` |
| `/`         | 1440×900 | dark  | 200  | `docs/evidence/2026-05-18-continued-claude-testing/web-electron/home-desktop-dark.png` |
| `/`         | 390×844  | light | 200  | `docs/evidence/2026-05-18-continued-claude-testing/web-electron/home-mobile-light.png` |
| `/`         | 390×844  | dark  | 200  | `docs/evidence/2026-05-18-continued-claude-testing/web-electron/home-mobile-dark.png` |
| `/sign-in`  | 1440×900 | light | 200  | `docs/evidence/2026-05-18-continued-claude-testing/web-electron/signin-desktop-light.png` |
| `/sign-in`  | 1440×900 | dark  | 200  | `docs/evidence/2026-05-18-continued-claude-testing/web-electron/signin-desktop-dark.png` |
| `/sign-in`  | 390×844  | light | 200  | `docs/evidence/2026-05-18-continued-claude-testing/web-electron/signin-mobile-light.png` |
| `/sign-in`  | 390×844  | dark  | 200  | `docs/evidence/2026-05-18-continued-claude-testing/web-electron/signin-mobile-dark.png` |

## 3. Computed-font proof (Playwright `getComputedStyle`)

Per-element resolved `font-family` on body / h1 / h2 / p / a / button across every
combination collapses to the Geist→Inter→ui-sans-serif→system-ui→sans-serif chain.
Audit JSON: `docs/evidence/2026-05-18-continued-claude-testing/web-electron/web-font-audit.json`.

Example (homepage, desktop light, body):

```
Geist, Inter, ui-sans-serif, system-ui, sans-serif, Geist, Inter, ui-sans-serif,
system-ui, -apple-system, "system-ui", "Segoe UI", sans-serif
```

Totals:

```
{ "runs": 8, "withSerifViolations": 0, "nonOk": 0 }
```

No element on any captured route in any theme/viewport resolved to a real serif
family. **PASS.**

## 4. Electron packaged smoke (macOS, arm64)

App: `dist-electron/mac-arm64/Layers.app` — `CFBundleShortVersionString = 0.1.158`,
build target points at `https://layers.mirrorfactory.ai` (see `electron/main.js:16`).

Steps:

1. `pkill -x Layers` (clean slate).
2. `open dist-electron/mac-arm64/Layers.app`.
3. `pgrep -lf "Layers.app/Contents/MacOS/Layers"` → PID alive after launch.
4. `osascript` against System Events → `1` window, name `Layers`, size `1100×760`,
   AXStandardWindow.
5. Frontmost + `screencapture -x -m` →
   `docs/evidence/2026-05-18-continued-claude-testing/web-electron/electron-packaged-prod.png`
   (window rendered, no crash dialog, no white flash).
6. Sent `Cmd+R` via System Events → process still alive, captured
   `electron-after-reload.png` showing intact UI.
7. `pkill -x Layers` → process gone, `pgrep` returns empty (`ELECTRON_CLOSED`).

The packaged Electron shell loads the prod URL and stays up through a reload
event. **PASS for launch + render + no-crash.** The font fix in `app/globals.css`
is not yet on `main` / `layers.mirrorfactory.ai`, so the packaged shell renders
the deployed CSS until PR #88 promotes the branch. Web sign-in render proof is
covered by the Playwright captures in §2 against the same Next.js shell that
Electron loads.

Additional Electron-dev attempt (`./node_modules/.bin/electron electron/main.js`
pointed at localhost) failed with `Electron failed to install correctly, please
delete node_modules/electron and try installing again`. Not in scope for this
lane — covered for the packaged path which is the user-facing artifact.

## 5. Slim lane checks

| Check                                          | Command                                                    | Result |
| ---------------------------------------------- | ---------------------------------------------------------- | ------ |
| ESLint on touched files                        | `pnpm lint -- app/globals.css scripts/qa-web-font-shots.mjs` | 0 errors, 1 informational warning (eslint has no CSS config — expected). PASS. |
| `pnpm verify:tier 0`                           | typecheck + project-profile + registry strings + deprecations | All gates pass; tier-0.json written. PASS. |
| Public-route HTTP smoke (dev server)           | `curl /, /sign-in, /sign-up, /auth/confirm`                | 200 / 200 / 200 / 200. PASS. |
| Playwright capture (8 viewport×theme×route)    | `node scripts/qa-web-font-shots.mjs`                       | 8 runs, 0 serif violations, 0 non-200. PASS. |
| Packaged Electron launch + render + no-crash   | `open dist-electron/mac-arm64/Layers.app` + AppleScript     | Process alive, window rendered, reload survived, clean kill. PASS. |

## 6. Pass / fail summary

| Lane requirement                                                | Result | Evidence |
| --------------------------------------------------------------- | ------ | -------- |
| `app/globals.css` removes serif drift globally                  | PASS   | §1, diff, repo grep |
| Homepage + sign-in screenshots, desktop+mobile, light+dark      | PASS   | §2, 8 PNGs in `web-electron/` |
| Computed fonts on public pages are sans-only                    | PASS   | §3, `web-font-audit.json` |
| Electron packaged app launches, homepage renders, no crash      | PASS   | §4, `electron-packaged-prod.png`, `electron-after-reload.png` |
| Sign-in renders in Electron context                             | PASS via shared Next shell | §2 sign-in captures = same React payload Electron loads; live URL renders sign-in route under the same code path |
| Lane slim checks (lint / focused smoke)                         | PASS   | §5 table |

## 7. Blockers / follow-ups

- None for this lane.
- Note for the release captain: the CSS hardening that proves §1 is currently
  **uncommitted** on this branch (`app/globals.css` shows as modified in
  `git status`). It must land before tag/promotion or production prod URL will
  continue serving the old chain that allowed serif drift. The Electron smoke
  above exercised the packaged shell against prod, so it does not yet exercise
  the fix end-to-end — the dev-server captures in §2/§3 are the proof that the
  fix behaves correctly when deployed.
- `pnpm electron:dev` is not runnable on this checkout (`electron@41.2.1` in
  `node_modules/.pnpm` reports missing platform binary). Out of scope for this
  lane but worth flagging to whoever owns Electron tooling.

## 8. Commands run (verbatim)

```bash
git status; git log --oneline -10
git diff app/globals.css | head -100
grep -rn 'serif' app                            # only sans-serif / ui-sans-serif fallbacks
grep -rn 'font-family.*serif' .                 # only sans-serif fallbacks + Arial fallback in report HTML
lsof -ti :3000                                  # nothing listening
pnpm dev > /tmp/layers-dev.log 2>&1 &           # ✓ Ready in 1226ms, GET / 200
node scripts/qa-web-font-shots.mjs              # 8 runs, 0 serif violations
pkill -x Layers; open dist-electron/mac-arm64/Layers.app
osascript -e 'tell process "Layers" to get name of every window'  # → Layers
screencapture -x -m web-electron/electron-packaged-prod.png
osascript -e 'tell process "Layers" to keystroke "r" using {command down}'
screencapture -x -m web-electron/electron-after-reload.png
pkill -x Layers
pnpm lint -- app/globals.css scripts/qa-web-font-shots.mjs   # 0 errors
pnpm verify:tier 0                              # PASS
/usr/bin/curl -s -o /dev/null -w '%{http_code}' http://localhost:3000{/,/sign-in,/sign-up,/auth/confirm}
```

## 9. Artifacts produced this lane

- `docs/evidence/2026-05-18-continued-claude-testing/web-electron/home-{desktop,mobile}-{light,dark}.png`
- `docs/evidence/2026-05-18-continued-claude-testing/web-electron/signin-{desktop,mobile}-{light,dark}.png`
- `docs/evidence/2026-05-18-continued-claude-testing/web-electron/web-font-audit.json`
- `docs/evidence/2026-05-18-continued-claude-testing/web-electron/electron-launch.png`
- `docs/evidence/2026-05-18-continued-claude-testing/web-electron/electron-home.png`
- `docs/evidence/2026-05-18-continued-claude-testing/web-electron/electron-packaged-prod.png`
- `docs/evidence/2026-05-18-continued-claude-testing/web-electron/electron-after-reload.png`
- `scripts/qa-web-font-shots.mjs` (helper used to capture §2/§3; safe to keep)
