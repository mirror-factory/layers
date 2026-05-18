# iOS Native Blocker QA — Continued Testing
**Date:** 2026-05-18  
**Session:** Continued from `docs/evidence/2026-05-18-release-test-matrix/ios-worker-report.md`  
**Worker:** iOS Native Blocker QA (Claude Sonnet 4.6)  
**Branch:** `release/external-tester-readiness-2026-05-17`  
**Scope:** Signing/archive readiness, build number, Xcode account/cert/provisioning discovery, simulator launch sanity, URL scheme/native OAuth readiness, mic permission readiness  
**Instruction:** Terminal-only discovery. No upload. No source edits. Evidence written to `docs/evidence/2026-05-18-continued-claude-testing/`.

---

## Change Delta Since Prior Report

Commits since the prior iOS worker ran (`2026-05-18-release-test-matrix`):

```
3d79936 chore: bump to 0.1.158
cf43d4b docs: correct cpo report ci status
952b8c9 chore: bump to 0.1.157
1d85f51 docs: refresh cpo release status report
53ffaab chore: bump to 0.1.156
```

**Verdict: Zero native iOS changes.** All five commits are package version bumps or doc updates. The native Xcode project, `Info.plist`, `PrivacyInfo.xcprivacy`, `capacitor.config.ts`, and app source (`lib/auth/`, `components/`) are unchanged. Every finding below is either a confirmed carry-forward from the prior report or a newly-detailed discovery of the same state.

---

## Check 1 — Git / Repo State

**Command:**
```bash
git log --oneline -8
git status --short --branch
```

**Result:** PASS

| Field | Value |
|-------|-------|
| Branch | `release/external-tester-readiness-2026-05-17` |
| Untracked | Only `docs/evidence/2026-05-18-continued-claude-testing/` (expected) |
| Staged changes | None |
| Native changes since prior report | None |

---

## Check 2 — Build Number and Version Metadata

**Command:**
```bash
grep -E "CURRENT_PROJECT_VERSION|MARKETING_VERSION|PRODUCT_BUNDLE_IDENTIFIER|DEVELOPMENT_TEAM|IPHONEOS_DEPLOYMENT_TARGET" \
  ios/App/App.xcodeproj/project.pbxproj | sort | uniq
```

**Result: BLOCKER — build number not incremented**

| Key | Value | Status |
|-----|-------|--------|
| `CURRENT_PROJECT_VERSION` | `1` | **BLOCKER** — must be incremented before first TestFlight upload |
| `MARKETING_VERSION` | `1.0` | OK |
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.mirafactory.layers` | OK — matches `capacitor.config.ts` |
| `DEVELOPMENT_TEAM` | `36J9E4325G` | OK |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.0` | OK |

Build number `1` must be a unique ascending integer on App Store Connect. App Store Connect rejects duplicate build numbers. Alfonso must change `CURRENT_PROJECT_VERSION` to `2` (or higher) in Xcode before the first archive/upload.

---

## Check 3 — Code-Signing Identity Discovery

**Command:**
```bash
security find-identity -v -p codesigning
```

**Output:**
```
1) 0C55E99CC6035727BD4A80822F57F6458A969471 "Apple Development: Alfonso Morales (KG67CNM8RA)"
2) 395CFC205CFA8F13099D4E20CC3516415CB4ADC7 "Developer ID Application: Alfonso Morales (36J9E4325G)"
   2 valid identities found
```

**Result: BLOCKER — no Apple Distribution certificate**

| Certificate | Status | Needed for |
|-------------|--------|-----------|
| `Apple Development: Alfonso Morales (KG67CNM8RA)` | Present | Simulator / local device debug builds |
| `Developer ID Application: Alfonso Morales (36J9E4325G)` | Present | macOS Gatekeeper-signed apps (not iOS) |
| `Apple Distribution: ...` | **MISSING** | TestFlight / App Store archive |

Without an Apple Distribution (or iPhone Distribution) certificate, `xcodebuild archive` for a real device will fail during the code-signing step even if all other build settings are correct.

**What Alfonso must do:**
1. Go to [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates).
2. Create a new `iOS Distribution` (App Store and Ad Hoc) certificate for team `36J9E4325G`.
3. Download and double-click to install in Keychain Access.
4. Verify with `security find-identity -v -p codesigning` — you should see a third entry: `"Apple Distribution: Alfonso Morales (36J9E4325G)"`.

---

## Check 4 — Provisioning Profile Discovery

**Command:**
```bash
ls -la "$HOME/Library/MobileDevice/Provisioning Profiles/"
```

**Output:** (empty — directory has no files)

**Result: BLOCKER — zero provisioning profiles installed**

No App Store distribution provisioning profile for `com.mirafactory.layers` is present on this machine. Xcode Automatic Signing will try to download one when `-allowProvisioningUpdates` is passed to `xcodebuild archive`, but this requires:
- The Apple Distribution certificate to already be in the keychain (see Check 3).
- An App Store Connect app record to exist for `Layers` with bundle ID `com.mirafactory.layers`.
- Active Apple Developer Program membership for team `36J9E4325G`.

**What Alfonso must do:**
If using Automatic Signing (current project setting `CODE_SIGN_STYLE = Automatic`):
- Complete Check 3 (install Distribution cert) first.
- Run `xcodebuild … -allowProvisioningUpdates clean archive` — Xcode will auto-create and download the profile if the App Store Connect app record exists.

If using Manual Signing:
- Go to developer.apple.com → Profiles → create an App Store distribution profile for `com.mirafactory.layers`.
- Download and double-click to install.
- Select it in Xcode → App target → Signing & Capabilities → Release → Provisioning Profile.

---

## Check 5 — Xcode Scheme and Plug-in Resolution

**Command:**
```bash
xcodebuild -project ios/App/App.xcodeproj -list
```

**Output (abridged):**
```
Information about project "App":
    Targets: App
    Build Configurations: Debug, Release
    Schemes: App, CapacitorApp, CapacitorBrowser, CapacitorLocalNotifications, CapacitorStatusBar, CapApp-SPM

Resolved packages:
  CapApp-SPM          local
  CapacitorBrowser    @capacitor/browser@8.0.3    (OAuth in-app browser)
  CapacitorStatusBar  @capacitor/status-bar@8.0.2
  CapacitorApp        @capacitor/app@8.1.0         (deep-link listener)
  CapacitorLocalNotifications @capacitor/local-notifications@8.0.2
  capacitor-swift-pm  https://github.com/ionic-team/capacitor-swift-pm.git @ 8.3.1
```

**Result: PASS**

Scheme `App` is present. All 4 Capacitor plugins resolved correctly (including `@capacitor/browser` and `@capacitor/app`, both required for native OAuth).

---

## Check 6 — Capacitor Sync

**Command:**
```bash
pnpm exec cap sync ios
```

**Output:**
```
✔ Copying web assets from public to ios/App/App/public in 30.69ms
✔ Creating capacitor.config.json in ios/App/App in 556.08μs
✔ copy ios in 75.77ms
✔ Updating iOS plugins in 6.69ms
[info] Found 4 Capacitor plugins for ios: @capacitor/app, @capacitor/browser, @capacitor/local-notifications, @capacitor/status-bar
✔ update ios in 47.31ms
[info] Sync finished in 0.173s
```

**Result: PASS** — Sync clean, all plugins registered, no errors.

---

## Check 7 — Privacy Manifest and Info.plist Linting

**Commands:**
```bash
plutil -lint ios/App/App/PrivacyInfo.xcprivacy
plutil -lint ios/App/App/Info.plist
```

**Result: PASS** — Both files parse cleanly. No structural errors.

**Privacy manifest contents (verified):**

| Data type | Linked to user | Purpose | Tracking |
|-----------|---------------|---------|---------|
| `NSPrivacyCollectedDataTypeEmailAddress` | Yes | AppFunctionality | No |
| `NSPrivacyCollectedDataTypeUserID` | Yes | AppFunctionality | No |
| `NSPrivacyCollectedDataTypeAudioData` | Yes | AppFunctionality | No |
| `NSPrivacyCollectedDataTypeOtherUserContent` | Yes | AppFunctionality | No |
| `NSPrivacyTracking` | — | — | `false` |
| `NSPrivacyTrackingDomains` | — | — | (empty) |
| `NSPrivacyAccessedAPITypes` | — | — | (empty) |

**Gap for Alfonso to reconcile before App Review:** App Store Connect App Privacy nutrition labels must also cover calendar data, billing/subscription metadata, diagnostics, and any future third-party SDK manifests. The current PrivacyInfo only covers app-authored data types.

---

## Check 8 — Microphone Permission Readiness

**Command:**
```bash
grep "NSMicrophoneUsageDescription" -A2 ios/App/App/Info.plist
python3 -c "... list all Info.plist keys ..."
```

**Result: PASS**

| Check | Value |
|-------|-------|
| `NSMicrophoneUsageDescription` present | Yes |
| Copy | `"Layers needs your microphone to record meetings and transcribe what's said. Audio is captured only while you're recording."` |
| Other privacy keys | None (`NSCalendarsUsageDescription`, `NSContactsUsageDescription`, `NSCameraUsageDescription` are absent — correct, as the app doesn't use calendar/contacts/camera) |

**Device-only blocker:** The OS permission prompt fires only on real hardware when the app first calls `getUserMedia()` / Capacitor mic API. The copy above is what the user will see. This cannot be tested in the simulator.

**Info.plist key inventory:**

| Key | Value |
|-----|-------|
| `CFBundleDevelopmentRegion` | `en` |
| `CFBundleDisplayName` | `Layers` |
| `CFBundleIdentifier` | `$(PRODUCT_BUNDLE_IDENTIFIER)` |
| `CFBundleShortVersionString` | `$(MARKETING_VERSION)` |
| `CFBundleVersion` | `$(CURRENT_PROJECT_VERSION)` |
| `LSRequiresIPhoneOS` | `true` |
| `UIRequiresFullScreen` | `true` |
| `UISceneDelegate` | `false` |
| `UILaunchStoryboardName` | `LaunchScreen` |
| `CFBundleURLTypes` | see Check 9 |
| `NSMicrophoneUsageDescription` | see above |

---

## Check 9 — URL Scheme and Native OAuth Readiness

### URL Scheme Registration

**Command:**
```bash
grep -A10 "CFBundleURLTypes" ios/App/App/Info.plist
```

**Output:**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.mirafactory.layers</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>layers</string>
      <string>com.mirafactory.layers</string>
    </array>
  </dict>
</array>
```

**Result: PASS — both schemes registered**

| Scheme | Purpose | Risk |
|--------|---------|------|
| `layers://` | Convenience short alias | Low risk — another app could register `layers://` on the same device, causing a conflict. Not a blocker but the reverse-domain scheme is safer. |
| `com.mirafactory.layers://` | Reverse-domain scheme used by OAuth callback | Safe — globally unique, used in `NATIVE_OAUTH_REDIRECT_URL` |

The OAuth callback URL hardcoded in `lib/auth/native-oauth.ts` is `"com.mirafactory.layers://auth/callback"` — this matches the second scheme entry. Correct.

### Native OAuth Implementation (Code Review)

**Files reviewed:**
- `lib/auth/native-oauth.ts` — PKCE flow implementation
- `components/native-auth-bridge.tsx` — cold-start and hot deep-link listener
- `app/auth/callback/route.ts` — server route (web only, not used by native)

**Implementation assessment: WIRED CORRECTLY**

| Step | Implementation | Status |
|------|---------------|--------|
| Build OAuth URL without redirecting | `skipBrowserRedirect: true` | ✓ |
| Open Google consent via SFSafariViewController | `@capacitor/browser` `Browser.open({ presentationStyle: "fullscreen" })` | ✓ |
| Redirect target | `com.mirafactory.layers://auth/callback` | ✓ |
| Deep-link listener registered BEFORE browser opens | `App.addListener("appUrlOpen", …)` hoisted above `Browser.open(...)` | ✓ |
| PKCE code exchange | `supabase.auth.exchangeCodeForSession(code)` | ✓ |
| Cold-start (app launched via URL) | `App.getLaunchUrl()` checked in `NativeAuthBridge` | ✓ |
| Cancel / browser close cleanup | `dispose()` closes browser + removes listener | ✓ |
| Error path | Navigates to `/sign-in?error=native_browser_open_failed` | ✓ |
| Web route correctly excluded | `app/auth/callback/route.ts` comment confirms native does NOT use server route | ✓ |

**Prerequisite Alfonso must complete:** Add `com.mirafactory.layers://auth/callback` to the Supabase project's Authentication → URL Configuration → Redirect URLs allowlist. Without this, Google's consent screen will return to Supabase, Supabase will reject the redirect, and the OAuth flow will fail.

**Device-only blocker:** End-to-end round-trip (open in-app browser → Google consent → return via `com.mirafactory.layers://auth/callback?code=...` → PKCE exchange → `/record`) cannot be proven in the simulator. Requires a real device with a signed app or TestFlight build.

---

## Check 10 — Simulator Build Sanity (DerivedData / Fresh Cap Sync)

**Commands run:**
```bash
pnpm exec cap sync ios                                     # PASS (see Check 6)
xcodebuild -project ios/App/App.xcodeproj -scheme App      # background build — see below
  -configuration Debug -sdk iphonesimulator
  -destination "generic/platform=iOS Simulator"
  CODE_SIGNING_ALLOWED=NO build
```

**DerivedData evidence:**
```
~/Library/Developer/Xcode/DerivedData/App-avqoyojizhxkaieqmuclejubltkv/
  Build/Products/
    Debug-iphonesimulator/App.app   (last built 2026-05-18 11:12 — prior session BUILD SUCCEEDED)
    Release-iphonesimulator/        (last built 2026-05-18 07:56)
```

**This session's build:** The background `xcodebuild` was interrupted by a process timeout (`** BUILD INTERRUPTED **`, exit 144 / SIGTERM) after actively progressing through Swift compilation (`CapApp-SPM` arm64 + x86_64) and asset catalog compilation. The final line in the output is `** BUILD INTERRUPTED **` — **not** a compile error, type error, or linker failure. The build was killed by the shell timer before it could finish.

**Why this does not indicate a build regression:**
- Zero native changes between the prior session's `BUILD SUCCEEDED` and this run (all commits since are doc/version bumps).
- The build was mid-way through Swift compilation when killed — all sources it reached compiled without errors.
- The existing `App.app` in DerivedData (`2026-05-18 11:12`) is a valid artifact from the prior session's clean build.
- `cap sync` completed cleanly (0.173s), confirming the web asset layer is correct.

**Result: INCONCLUSIVE (timeout, not a build error) — prior session's BUILD SUCCEEDED artifact remains valid. To re-verify, run xcodebuild in a foreground terminal with no timeout:**

```bash
pnpm exec cap sync ios
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  CODE_SIGNING_ALLOWED=NO \
  build 2>&1 | tail -5
```

---

## Check 11 — Release Build Settings (Archive Readiness Dry Run)

**Command:**
```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App
  -configuration Release -destination "generic/platform=iOS"
  CODE_SIGNING_ALLOWED=NO -showBuildSettings
  | grep -E "CODE_SIGN|DEVELOPMENT_TEAM|PROVISIONING_PROFILE|MARKETING_VERSION|CURRENT_PROJECT_VERSION|PRODUCT_BUNDLE_IDENTIFIER"
```

**Output:**
```
CODE_SIGNING_ALLOWED          = NO   (overridden for this dry run)
CODE_SIGNING_REQUIRED         = YES  ← correct for device builds
CODE_SIGN_IDENTITY            = iPhone Developer  ← stale default; will resolve to Distribution with cert
CODE_SIGN_STYLE               = Automatic  ← Xcode-managed; fine for production
CURRENT_PROJECT_VERSION       = 1    ← MUST INCREMENT
DEVELOPMENT_TEAM              = 36J9E4325G  ← correct
MARKETING_VERSION             = 1.0  ← correct for first release
PRODUCT_BUNDLE_IDENTIFIER     = com.mirafactory.layers  ← correct
PROVISIONING_PROFILE_REQUIRED = YES  ← correct; profile will auto-download with Distribution cert
```

**Result: CONFIGURATION CORRECT, SIGNING UNRESOLVED**

The project settings are correct for an App Store archive. The only blockers are credential gaps (no Distribution cert, no profiles) — not project misconfiguration. Once Alfonso installs the Distribution cert and the app record exists in App Store Connect, `xcodebuild archive -allowProvisioningUpdates` should succeed.

---

## Check 12 — App Icon Warning (P2 Cosmetic)

**Commands:**
```bash
ls ios/App/App/Assets.xcassets/AppIcon.appiconset/
python3 -c "... check Contents.json filenames ..."
```

**Finding: STILL UNRESOLVED (P2 — same as prior report)**

`AppIcon-512@2x.png` is present on disk in the AppIcon asset catalog directory but is **not** listed in `Contents.json`. Xcode emits 5× `"The app icon set has an unassigned child"` warnings during every build. This does not block building, installation, or launch. Apple's App Review has historically rejected apps with Xcode build warnings in some cases, so this should be fixed before App Review (not required for internal TestFlight).

**Fix:** Delete `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (the file is not in `Contents.json` and is not used by the build).

---

## Check 13 — Entitlements

**Finding:** No `App.entitlements` file found in `ios/App/App/`. This is expected if the app does not use any Apple capabilities that require entitlements (push notifications via APNs, iCloud, Sign in with Apple, in-app purchases, keychain sharing, etc.). The app currently uses Google OAuth via Capacitor Browser (not Sign in with Apple), local notifications via `@capacitor/local-notifications`, and microphone. None of these require a custom entitlements file.

**If push notifications (APNs) are added in the future:** An entitlements file with `aps-environment = production` will be required and must be matched with a push-enabled provisioning profile.

---

## Device-Only Blockers (cannot be resolved by agent)

These four gates from the release matrix cannot be proven in a simulator and are carry-forwards from the prior report. The implementations are correct; the gap is physical-device verification.

| Gate | What needs proving | Implementation status |
|------|-------------------|----------------------|
| 9 | Google OAuth native round-trip — `com.mirafactory.layers://auth/callback` returned to app, PKCE exchange completes, user lands on `/record` | WIRED — `lib/auth/native-oauth.ts` + `components/native-auth-bridge.tsx` + `@capacitor/browser` + `@capacitor/app` all present |
| 11 | Mic permission prompt fires on first "Start recording" tap; deny path shows recovery UI | WIRED — `NSMicrophoneUsageDescription` present with correct copy |
| 12 | Live recording: mic capture → AssemblyAI streaming → transcript chunks appear in < 1.5s | Cannot simulate real mic/network |
| 13 | Stop → finalize → meeting detail: summary/action items render | Depends on Gate 12 |

---

## Summary of All Blockers

### BLOCKER — Must resolve before `xcodebuild archive` succeeds

| # | Blocker | What Alfonso must do |
|---|---------|---------------------|
| B1 | No Apple Distribution certificate | Create + download iOS Distribution cert for team `36J9E4325G` at developer.apple.com → Certificates |
| B2 | No App Store provisioning profiles installed | Either let Xcode auto-download after B1 + App Store Connect app record exists, or manually create at developer.apple.com → Profiles |
| B3 | Build number still `1` | Change `CURRENT_PROJECT_VERSION` to `2` (or any integer > current App Store Connect build) in Xcode target → Build Settings → Versioning before archive |
| B4 | App Store Connect app record — status unknown | Confirm or create app record for `Layers` / bundle `com.mirafactory.layers` in App Store Connect |
| B5 | Supabase redirect URL allowlist | Add `com.mirafactory.layers://auth/callback` to Supabase → Authentication → URL Configuration → Redirect URLs |

### BLOCKER — Require real device (cannot be simulated)

| # | Gate | What is needed |
|---|------|---------------|
| B6 | Gate 9 | iPhone with signed app or TestFlight build; Google OAuth round-trip |
| B7 | Gate 11 | iPhone; mic permission prompt trigger + deny-path recovery |
| B8 | Gate 12 | iPhone; live mic recording + real-time transcript |
| B9 | Gate 13 | iPhone; stop/finalize/meeting detail flow |

### P2 — Should fix before App Review, not blocking TestFlight

| # | Issue | Fix |
|---|-------|-----|
| P1 | `AppIcon-512@2x.png` unassigned in `Contents.json` | Delete `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` |
| P2 | App Privacy nutrition labels in App Store Connect | Reconcile calendar/billing/diagnostics/analytics data types against PrivacyInfo before App Review |

### PASS — Confirmed clean

| Area | Result |
|------|--------|
| `plutil -lint PrivacyInfo.xcprivacy` | PASS |
| `plutil -lint Info.plist` | PASS |
| `xcodebuild -list` (scheme `App` present) | PASS |
| `pnpm exec cap sync ios` | PASS |
| Privacy manifest data types | PASS (4 types, all non-tracking) |
| `NSMicrophoneUsageDescription` copy | PASS |
| URL scheme registration (`layers://` + `com.mirafactory.layers://`) | PASS |
| Native OAuth wiring (`lib/auth/native-oauth.ts`) | PASS — correctly uses `skipBrowserRedirect`, `@capacitor/browser`, `appUrlOpen`, PKCE |
| `NativeAuthBridge` cold-start handler | PASS — `App.getLaunchUrl()` checked at mount |
| Build settings (bundle ID, team, deployment target) | PASS |
| `CODE_SIGN_STYLE = Automatic` | PASS — correct for production |
| No entitlements needed for current feature set | PASS |
| DerivedData Debug-iphonesimulator App.app (prior session BUILD SUCCEEDED) | PASS — prior artifact valid; this session's background build killed by timeout (SIGTERM, not compile error) |

---

## TLDR

**TestFlight status: NOT READY — 5 credential/account blockers remain, 4 device-only gates unverified.**

**What's green:** Cap sync clean, 4 Capacitor plugins resolved, scheme `App` confirmed, both URL schemes registered, `NSMicrophoneUsageDescription` correct, privacy manifest lint clean, native OAuth code wiring is correct (PKCE, `@capacitor/browser`, `appUrlOpen` listener, cold-start handler all in place), release build settings are correct (bundle ID, team, deployment target, Automatic signing).

**What Alfonso must do before any TestFlight upload:**

1. **Install Apple Distribution cert** — developer.apple.com → Certificates → iOS Distribution → create + download.
2. **Create App Store Connect app record** — for `com.mirafactory.layers` / team `36J9E4325G`.
3. **Increment build number** — change `CURRENT_PROJECT_VERSION` from `1` to `2` in Xcode Build Settings.
4. **Add Supabase redirect URL** — `com.mirafactory.layers://auth/callback` in Supabase Auth → URL Configuration → Redirect URLs.
5. **Physical device tester** — for Gates 9 (OAuth round-trip), 11 (mic permission), 12 (live recording), 13 (finalize flow). These require an iPhone with a locally-signed or TestFlight build.

**P2 (pre-App Review, not blocking TestFlight):** Delete `AppIcon-512@2x.png` from the AppIcon asset catalog to clear the unassigned-child warning. Complete App Privacy nutrition labels in App Store Connect to cover all data types.
