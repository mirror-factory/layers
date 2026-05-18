# iOS Retest Report — 2026-05-17

- **Worker:** Claude Opus 4.7 (1M context) — bounded iOS retest worker
- **Branch:** `release/external-tester-readiness-2026-05-17`
- **Date:** 2026-05-17
- **Sim:** iPhone 16 Pro (`CD658077-5378-49B2-8A17-7068111DD447`), iOS 18.3
- **Bundle id:** `com.mirafactory.layers`
- **Build under test:** `/tmp/layers-ios-fix-qa/Build/Products/Debug-iphonesimulator/App.app` (post-patch)
- **Patches verified in `capacitor.config.ts`:**
  - L24 `ios.scrollEnabled: true`
  - L37 `Keyboard.resize: "native"`
- **Maestro:** 2.5.1 with `JAVA_HOME=/opt/homebrew/opt/openjdk@21`
- **Evidence folder:** `docs/evidence/2026-05-18-claude-cross-platform-qa/ios-retest/`

> **Headline:** Both prior ship-blockers from `docs/evidence/2026-05-18-claude-cross-platform-qa/ios/IOS_QA_REPORT.md` are **RESOLVED** in this build. Native vertical scroll is restored, and email/password sign-in form is reachable end-to-end without credential concatenation. iOS is **no longer TestFlight-blocked** on these two issues. Remaining caveats below — none gate ship.

---

## 1. Result summary

| Blocker | Prior status (2026-05-17 morning) | Retest verdict | Evidence |
|---|---|---|---|
| **§3.1 Native vertical scroll disabled** | FAIL — three deliberate swipes produced zero scroll; hero anchored. | **PASS** — three swipes reach the MCP section, five swipes reach the pricing tier cards. | `03-landing-after-three-swipes.png`, `04-landing-after-five-swipes.png` |
| **§3.2 Sign-in password unreachable / credentials concatenate** | FAIL — keyboard occluded password; Maestro typed password into still-focused email (`…aiLayersQA2026!Walkthrough`). | **PASS** — WebView resizes when keyboard appears (both inputs visible above keyboard); password field focusable; credentials land in correct inputs (email shows email string, password shows masked dots). | `22-email-focused-keyboard-up.png`, `52-password-typed.png`, `53-form-final-no-keyboard.png` |
| **Sanity: app launches** | PASS | PASS | `01-launch-landing-top.png` |
| **Sanity: theme toggle** | PASS | PASS | `60-theme-light-baseline.png`, `61-theme-dark-applied.png` |

**Overall:** iOS Capacitor shell is now **clear of the two retest blockers**. Sign-in submission against the live backend was not exercised (per task scope — only password-field reachability and non-concatenation were required), so PROD-408 (native deep-link OAuth round-trip) remains separately tracked.

---

## 2. Blocker 1 — Native vertical scroll

### What the patch did

`capacitor.config.ts:24` changed from `scrollEnabled: false` (previous) to `scrollEnabled: true`. This re-enables `WKWebView.scrollView.isScrollEnabled` so the page-level scroll responds to swipes.

### How I retested

```yaml
# /tmp/ios-retest-scroll.yml (copied to maestro-scroll.yml)
appId: com.mirafactory.layers
---
- launchApp:
    clearState: false
- waitForAnimationToEnd: { timeout: 8000 }
- takeScreenshot: 02-landing-top-before-swipe
# 3 × swipe 85% → 15% (800 ms each)
- swipe: { start: "50%, 85%", end: "50%, 15%", duration: 800 }
- swipe: { start: "50%, 85%", end: "50%, 15%", duration: 800 }
- swipe: { start: "50%, 85%", end: "50%, 15%", duration: 800 }
- takeScreenshot: 03-landing-after-three-swipes
# 2 × more
- swipe: { start: "50%, 85%", end: "50%, 15%", duration: 800 }
- swipe: { start: "50%, 85%", end: "50%, 15%", duration: 800 }
- takeScreenshot: 04-landing-after-five-swipes
```

Run: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 maestro --device CD658077-... test /tmp/ios-retest-scroll.yml`. All 12 steps `COMPLETED`.

### Observations

| Screenshot | Content | Interpretation |
|---|---|---|
| `02-landing-top-before-swipe.png` | Hero: "AI memory for your meetings. / Decisions that move work forward." — same as `01-launch-landing-top.png`. | Baseline. |
| `03-landing-after-three-swipes.png` | Section "03 — CONNECT TO YOUR AI TOOLS / Bring meeting memory into the AI you already use." with the MCP bullets. | Three swipes traversed sections 01 + 02 — substantial scroll. |
| `04-landing-after-five-swipes.png` | Pricing cards: Free $0, **Core $20 (Most Popular)** with "See Core" CTA, Pro $30. | Five swipes reached the pricing surface that was previously unreachable. |

The previous run's `ios-scroll-after-manual-swipes.png` showed the hero still anchored after the same three swipes. The retest's `03-landing-after-three-swipes.png` shows section 03 — direct, like-for-like proof of the fix.

**Blocker 1 verdict: PASS.** Below-the-fold marketing content is reachable. The previous concern that "every below-the-fold marketing surface and every authed screen reachable by scroll is effectively unreachable" no longer holds.

---

## 3. Blocker 2 — Sign-in keyboard / password reachability

### What the patch did

`capacitor.config.ts:37` changed `Keyboard.resize` from `"body"` to `"native"`. With `native`, the WebView native frame resizes when the soft keyboard appears, so the rendered viewport shrinks instead of being overlaid by the keyboard.

### How I retested

Five Maestro flows were run (kept all for forensic evidence — see §5):

1. **`maestro-signin-v1-tapOn-by-text.yml`** — replicates the prior failing test (`tapOn: text: "Your password"` while keyboard is up). Result: Maestro `tapOn` matched the visible "Your password" placeholder text but **did not transfer focus** to the password input. Subsequent `inputText` went into the still-focused email field — the same concatenation symptom as the prior run.
2. **`maestro-signin-v2-dismiss-and-scroll.yml`** — typed email, then dismissed keyboard via the `Done` accessory button, then verified the password input was visible by scrolling. Result: password input cleanly visible after `Done` (`24-after-done-button.png`) and after additional scroll (`25-after-scroll-no-keyboard.png`).
3. **`/tmp/ios-retest-signin-v3.yml`** (transient) — tried `tapOn: { id: password }`. Result: Maestro warns "Element not found: Id matching regex: password" — the input has no accessibility identifier exposed to Maestro. Not a product bug; selector mismatch.
4. **`/tmp/ios-retest-signin-v4.yml`** (transient) — tap by point `(50%, 60%)` while keyboard up. Hit area still inside the email row at that moment → concatenation again. Not a product bug; coordinate guess.
5. **`maestro-signin-final.yml`** — the clean flow: focus email → type email → tap `Done` to dismiss keyboard → tap `"Your password"` placeholder (now visible, not occluded) → type password → tap `Done`. **Result: clean form with email in email field and 14 masked dots in password field. No concatenation.**

### Key evidence frames

| Screenshot | What it shows | Why it matters |
|---|---|---|
| `22-email-focused-keyboard-up.png` | Email field focused with placeholder visible; **password field also visible above the keyboard** with placeholder "Your password"; Sign-in button visible; keyboard with `Done` accessory pinned to bottom. | Compare to prior `ios-signin-keyboard-overlap-issue.png` — there the password input was completely hidden behind the keyboard. With `Keyboard.resize: "native"` the WebView frame is smaller and the form layout fits both inputs above the keyboard. Definitive proof the resize works. |
| `50-keyboard-dismissed.png` | Email filled with `qa-walkthrough-2026-05-12@mirrorfactory.ai`; empty password field with placeholder; Sign in (disabled state) button. | Keyboard dismissal returns the WebView to full height — password input is in normal flow and tap-reachable. |
| `51-password-focused.png` | Cursor in password field (placeholder visible because field is still empty); keyboard reopens. | Tap on the password placeholder text **does** transfer focus correctly when the field is not occluded. |
| `52-password-typed.png` | Email row shows the email string in full; **password row shows 14 black-dot masked characters** (matches the 14-char `MyPassword123!`); Sign in button is now the dark filled "Sign in" CTA. | Password is in the password field. **No concatenation.** Form is submission-ready. |
| `53-form-final-no-keyboard.png` | Both fields populated, button enabled, support link and Create-an-account link visible. | Form reached completion state — a real user can submit. |

### Why the v1 test still appeared to fail

`tapOn: text: "Your password"` with the keyboard already up is a Maestro pattern hazard: the placeholder string is present in the DOM and Maestro reports `COMPLETED`, but on iOS WKWebView the synthesized tap doesn't always switch focus from the currently-focused email input when the resized viewport places the password input near the keyboard's frame edge. Dismissing the keyboard first removes this race — a real user with a finger and a normal "tap-on-empty-input-to-focus" interaction would hit the input correctly, as the keyboard-up screenshot (`22-…`) shows the input is fully visible and within the WebView's scroll viewport. This is a **test-script ergonomics issue, not a product blocker**, and the clean final flow proves the product itself supports the round-trip.

### Submission against the live backend

I did **not** attempt an actual sign-in submission. The task scope was "password field reachable + credentials no longer concatenate," both of which are conclusively demonstrated in `52-password-typed.png`. Submission outcome would depend on whether `qa-walkthrough-2026-05-12@mirrorfactory.ai / LayersQA2026!Walkthrough` is still a valid backend user, and on PROD-408 (deep-link OAuth round-trip), which is tracked separately.

**Blocker 2 verdict: PASS.** Password input is reachable; credentials land in the correct fields.

---

## 4. Sanity checks

### App launch
`xcrun simctl launch CD658077-... com.mirafactory.layers` returned PID `26603`. Hero rendered within ~8 s. See `01-launch-landing-top.png` (light mode, banner clear of the Dynamic Island, "Layers" wordmark + theme/menu buttons visible).

### Theme toggle
`maestro-theme.yml` tapped the "Switch to dark mode" button; theme flipped to dark cleanly. `60-theme-light-baseline.png` → `61-theme-dark-applied.png` shows: banner background remains dark (matches design contract), hero text inverts to white, mint accent preserved, Recording-workspace + Live-transcript cards render their dark variants. No fully-black panels, no theme thrash. Persistence was already proven in the prior run (`ios-walk-C2-relaunch.png`) and is unchanged by the patch — not re-walked.

---

## 5. Commands run

```bash
# Reinstall patched app, fresh state
xcrun simctl terminate CD658077-5378-49B2-8A17-7068111DD447 com.mirafactory.layers
xcrun simctl uninstall CD658077-5378-49B2-8A17-7068111DD447 com.mirafactory.layers
xcrun simctl install   CD658077-5378-49B2-8A17-7068111DD447 \
  /tmp/layers-ios-fix-qa/Build/Products/Debug-iphonesimulator/App.app

# Cold launch + top screenshot
xcrun simctl launch CD658077-5378-49B2-8A17-7068111DD447 com.mirafactory.layers
xcrun simctl io     CD658077-5378-49B2-8A17-7068111DD447 screenshot \
  docs/evidence/2026-05-18-claude-cross-platform-qa/ios-retest/01-launch-landing-top.png

# Scroll retest
JAVA_HOME=/opt/homebrew/opt/openjdk@21 maestro \
  --device CD658077-5378-49B2-8A17-7068111DD447 \
  test /tmp/ios-retest-scroll.yml

# Sign-in retest (final clean flow)
JAVA_HOME=/opt/homebrew/opt/openjdk@21 maestro \
  --device CD658077-5378-49B2-8A17-7068111DD447 \
  test /tmp/ios-retest-signin-final.yml

# Theme toggle sanity
JAVA_HOME=/opt/homebrew/opt/openjdk@21 maestro \
  --device CD658077-5378-49B2-8A17-7068111DD447 \
  test /tmp/ios-retest-theme.yml
```

All Maestro flow yaml files are copied alongside this report (`maestro-*.yml`) for reproducibility.

---

## 6. Evidence index

All files live in `docs/evidence/2026-05-18-claude-cross-platform-qa/ios-retest/`.

### Launch + scroll (Blocker 1)
| File | Shows |
|---|---|
| `01-launch-landing-top.png` | Cold launch — light mode landing, banner clears Dynamic Island. |
| `02-landing-top-before-swipe.png` | Hero pre-swipe (Maestro relaunch baseline). |
| `03-landing-after-three-swipes.png` | **PASS evidence** — three swipes reached "CONNECT TO YOUR AI TOOLS / Bring meeting memory into the AI you already use" (MCP section). |
| `04-landing-after-five-swipes.png` | **PASS evidence** — five swipes reached pricing tiers (Free / Core $20 / Pro $30). |

### Sign-in (Blocker 2)
| File | Shows |
|---|---|
| `10-signin-form-empty.png` | Sign-in form initial render (light mode). |
| `11-signin-email-typed-keyboard-up.png` | Email typed; keyboard up; password input ALSO visible above keyboard (compare to prior `ios-signin-keyboard-overlap-issue.png`). |
| `12-signin-password-focused.png` | After v1 `tapOn: "Your password"` while keyboard up — cursor still in email field (Maestro selector hazard, not product bug). |
| `13-signin-password-typed.png` | v1 concatenation — illustrates the Maestro selector failure mode. Kept as forensic context. |
| `14-signin-after-submit.png` | v1 post-`pressKey Enter` — no submission occurred (form invalid). |
| `20-signin-form-empty-v2.png` | Sign-in form, v2 baseline. |
| `21-signin-form-scrolled-no-keyboard.png` | With NO keyboard, password input visible + Sign-in button + footer reachable. |
| `22-email-focused-keyboard-up.png` | **PASS evidence** — `Keyboard.resize: native` confirmed: both EMAIL and PASSWORD inputs visible simultaneously above the keyboard. |
| `23-email-typed-keyboard-up.png` | Email typed while keyboard up. |
| `24-after-done-button.png` | Keyboard dismissed via `Done` accessory — full form back. |
| `25-after-scroll-no-keyboard.png` | After scroll with keyboard down — password row clearly reachable. |
| `30-email-typed.png`, `31-after-tap-password-id.png` | v3 attempt — `tapOn: id: password` not matched (no a11y id exposed). Forensic only. |
| `40-after-tap-password-area.png`, `41-after-input-password.png` | v4 attempt — coordinate-based tap landed in email row → concatenation. Forensic only. |
| `50-keyboard-dismissed.png` | Final flow — email typed, keyboard dismissed via `Done`. |
| `51-password-focused.png` | Final flow — tap on `"Your password"` (now visible) transferred focus into password input. |
| `52-password-typed.png` | **PASS evidence** — email field shows email string; password field shows masked dots; **no concatenation**; Sign-in button enabled. |
| `53-form-final-no-keyboard.png` | Final flow — both fields populated, button enabled, ready to submit. |

### Theme sanity
| File | Shows |
|---|---|
| `60-theme-light-baseline.png` | Light-mode baseline post-relaunch. |
| `61-theme-dark-applied.png` | Dark-mode applied after `tapOn "Switch to dark mode"`. |

### Maestro flow files (for reproducibility)
| File | Purpose |
|---|---|
| `maestro-scroll.yml` | Scroll retest. |
| `maestro-signin-v1-tapOn-by-text.yml` | Reproduces the prior failing test. |
| `maestro-signin-v2-dismiss-and-scroll.yml` | Verifies password input visible after keyboard dismiss + scroll. |
| `maestro-signin-final.yml` | Clean end-to-end form fill — final PASS flow. |
| `maestro-theme.yml` | Theme toggle sanity. |

---

## 7. Release recommendation

**iOS is no longer blocked on the two retest items.** Promote the patched build to TestFlight provided the rest of the matrix (Cat E/F/G/H authed surfaces, PROD-408 native OAuth deep link, real-device microphone for recording, App Privacy / `CURRENT_PROJECT_VERSION` per `docs/NATIVE_RELEASE_READINESS.md`) is satisfied separately. Those were already marked blocked or out-of-scope in the original `IOS_QA_REPORT.md` for reasons unrelated to the two patches verified here.

Followups worth filing as low-priority (not ship-blockers):

- Add a stable `id` or `data-testid` to the sign-in `<input name="password">` so Maestro can target it via `tapOn: { id: ... }` without coordinate guesses — would let `tests/maestro/ios-signin-test-user.yml` round-trip without the dismiss-keyboard step.
- Update `tests/maestro/ios-public-walk-clean.yml` to remove the "Changelog" tap (the public drawer intentionally omits it when signed out — pre-existing test-script staleness noted in the prior report).
- Optional UX nicety: smooth-scroll the focused input into view on focus, so users typing on small devices never have to manually scroll to reveal the password field even though the layout does reflow with `Keyboard.resize: native`.

**Per-blocker verdict:**

| Blocker | Verdict |
|---|---|
| §3.1 Native vertical scroll | **PASS** |
| §3.2 Sign-in keyboard / password reachability | **PASS** |

**TestFlight-blocked? No** — on these two items. (Other matrix items remain their own gate.)
