# Release Pipeline

How the Layers app reaches users on every platform — what triggers builds, where artifacts land, who pays for the compute, and how to ship a new version.

> **TL;DR.** Push a tag (`git tag vX.Y.Z && git push --tags`) → GitHub Actions builds Mac/Windows/Android/iOS in parallel → Mac/Win/Android attach to a new GitHub Release → iOS auto-uploads to TestFlight. The `/download` page picks up the new artifacts automatically. Public repo, so all CI is free.

---

## What's in scope

| Surface | Framework | What ships | Where users get it |
| --- | --- | --- | --- |
| Web | Next.js 15 on Vercel | continuous deploy from `main` | `layers.mirrorfactory.ai` |
| macOS desktop | Electron | signed + notarized DMG (arm64 + x64) | GitHub Releases → linked from `/download` |
| Windows desktop | Electron | NSIS `.exe` installer (unsigned today) | GitHub Releases → linked from `/download` |
| Android | Capacitor + Gradle | debug APK | GitHub Releases → linked from `/download` |
| iOS | Capacitor + Xcode | signed IPA | TestFlight (auto) → App Store (manual promotion) |

Web is **continuous** — every push to `main` deploys via Vercel's own GitHub integration. The other four are **release-gated**: they only build when you push a `vX.Y.Z` tag.

---

## Trigger model

There are three ways CI runs:

```
push: branches: main      → web only (typecheck/test/build as a deploy guard)
push: tags: 'v*'          → full matrix + GitHub Release publish + TestFlight upload
workflow_dispatch         → full matrix, no GH Release publish (dry-run mode)
```

This means:

- Routine commits to `main` are cheap (one Linux job, no artifacts, no notarization).
- A tagged push is the *only* way a new DMG / EXE / APK / IPA reaches users.
- Tags can point at **any** commit on **any** branch — the workflow checks out the tagged commit and builds it. Convention: tag from `main` after the version-bump commit hits.

> **There is no `dev` or `staging` auto-publish.** The legacy `AGENTS.md` mentions `feature → development → staging → main`, but the `development` and `staging` branches don't exist yet (PROD-383 is Backlog). Until they're set up, the only path is `feature → main → tag`.

---

## How a release happens, step by step

### 1. Bump version, merge to main

The repo's commit hook auto-bumps `package.json`'s `version` after every code commit, so by the time you're ready to ship, `version` is already correct (e.g. `0.1.70`).

### 2. Tag and push

```bash
git checkout main
git pull
git tag v0.1.70
git push --tags
```

That's it. The rest is automatic.

### 3. CI fans out across five jobs

The workflow is `.github/workflows/build-release.yml`. On a tag push it kicks off:

```
                         tag push v0.1.70
                                |
        +-----------------------+-----------------------+----------+
        |              |               |               |          |
        v              v               v               v          v
   electron-mac   electron-win    capacitor-android  capacitor-ios  web
   (~12 min)      (~6 min)       (~6 min)         (~10 min)     (~3 min)
        |              |               |               |          |
        DMG arm64+x64  EXE             APK             IPA        deploy
        |              |               |               |          |
        +-----------+--+               |          xcrun altool   →  Vercel
                    |                  |               |
                    v                  v               v
              actions/download-artifact each          App Store Connect
                    |                                 (TestFlight)
                    v
               release job: rename to canonical filenames,
               gh release create v0.1.70 --generate-notes --latest
```

### 4. Filenames and where they land

The `release` job renames raw build outputs into stable filenames the `/download` page knows how to fetch:

| Built file | Renamed to | Final URL |
| --- | --- | --- |
| `Layers-0.1.70-arm64.dmg` | `Layers-mac-arm64.dmg` | `https://github.com/mirror-factory/layers/releases/latest/download/Layers-mac-arm64.dmg` |
| `Layers-0.1.70.dmg` | `Layers-mac-x64.dmg` | `…/Layers-mac-x64.dmg` |
| `Layers Setup 0.1.70.exe` | `Layers-windows.exe` | `…/Layers-windows.exe` |
| `app-debug.apk` | `Layers-android.apk` | `…/Layers-android.apk` |

`/releases/latest/download/<filename>` always 302-redirects to the most recent release tagged `--latest`, so the `/download` page never needs version awareness.

### 5. iOS goes elsewhere

The iOS job archives + exports the IPA, then runs `xcrun altool --upload-app`. The IPA never appears on GitHub Releases — it goes straight to App Store Connect. Apple takes ~5–15 min to process it; once processed it shows up under your TestFlight tab as `1.0 (<build_number>)` ready to push to your test groups.

The build number is auto-generated as `${GITHUB_RUN_NUMBER}${HHMM}` per CI run, monotonically increasing so it never collides with prior uploads.

---

## "When I tag, does TestFlight get a new build?"

Yes — every tagged push uploads a new IPA to TestFlight. So:

- `git push --tags v0.1.70` → new TestFlight build `1.0 (<run-number>)` shows up
- Your TestFlight test group gets notified the next time they open the app
- Users tap "Update" in TestFlight to pull the new build

If you tag *without* changing iOS code, you still get a new TestFlight upload (because the build number bumps). That's fine and expected — Apple keeps the previous version accessible too.

> **Branch tied to it?** The IPA is built from whichever commit the tag points at. If you tag from `main`, you ship `main`'s state. If you tag from a feature branch (rare), you ship that branch's state. Convention: only tag from `main`.

---

## Required GitHub Secrets

Settings → Secrets and Variables → Actions. All five are populated as of 2026-05-07:

| Secret | What it authenticates | Notes |
| --- | --- | --- |
| `APPLE_TEAM_ID` | All Apple operations | `36J9E4325G` |
| `APPLE_ID` | TestFlight upload | `crazyswami13@gmail.com` |
| `APPLE_APP_SPECIFIC_PASSWORD` | TestFlight upload | App-specific password from appleid.apple.com (label: `layers`) |
| `CSC_LINK` | Mac DMG signing | base64 of Developer ID Application `.p12`, exported from login keychain |
| `CSC_KEY_PASSWORD` | Mac DMG signing | password set during `.p12` export |

Optional alternative for TestFlight (preferred long-term, unattended):

| `APPLE_API_KEY_ID` + `APPLE_API_ISSUER` + `APPLE_API_KEY` | App Store Connect API key (`.p8`) | Generate at App Store Connect → Users and Access → Integrations → Keys |

The workflow detects which path is available at runtime and uses whichever is set.

If a secret is missing, the corresponding step degrades gracefully (e.g. unsigned DMG with a Gatekeeper warning, IPA built but not uploaded, etc.). It never hard-fails the whole release.

---

## Costs

**The `mirror-factory/layers` repo is public.** That means GitHub Actions is **free, unlimited, on every runner type**. No per-minute charges, no monthly cap, no Mac runner premium.

- macOS runners: free for public repos (would otherwise be ~$0.08/min × 10 min = $0.80/release)
- Windows runners: free
- Linux runners: free
- Storage of build artifacts: 500 MB-month is free, more than enough for a couple of recent builds; old runs auto-expire after 90 days
- GitHub Releases storage: free, unlimited

If the repo were ever flipped to **private**, costs would be:

| Plan | Free minutes/month | Mac runner cost | Estimated cost per tagged release | Releases/month within free tier |
| --- | --- | --- | --- | --- |
| Free | 2,000 | 10× multiplier ($0.08/min) | ~$2 (mostly Mac archive + notarize) | ~10 |
| Pro ($4/user/mo) | 3,000 | same | ~$2 | ~15 |
| Team ($4/user/mo) | 3,000 | same | ~$2 | ~15 |

**Today: $0. Don't change repo visibility unless you need to (see below).**

### Things that incur GitHub costs even on a public repo

- **GitHub Packages storage** (npm/Docker) above 500 MB-month — we don't use this for the app.
- **GitHub Copilot** seats (separate product).
- **GitHub Codespaces** beyond the free tier — we don't use these in CI.
- **Self-hosted runners** would need our own infra; we use GitHub-hosted runners.

### What costs do exist outside of GitHub

| Service | Why | Approx cost |
| --- | --- | --- |
| Apple Developer Program | iOS / Mac signing, TestFlight, App Store distribution | $99/year |
| App Store Connect API key | Free with Developer Program | — |
| Code-signing cert (Developer ID + Apple Distribution) | Included with Developer Program | — |
| Windows Authenticode cert (when added) | OV cert from a CA (DigiCert/Sectigo/etc.) | $100–$300/year |
| Apple notarization | Free with Developer Program | — |
| TestFlight | Free | — |

So today: **$99/year (Apple) + $0 (GitHub) = $99/year**.

---

## Vercel deployment (for `/download` to update)

The `/download` page is a Next.js route in this repo. Vercel deploys main automatically on push. Sequence:

1. PR merges to `main`
2. Vercel detects the push, runs `pnpm build` (~3 min)
3. Vercel promotes the build to `layers.mirrorfactory.ai`
4. The page is live with the latest URL constants

Note: the `/download` page links don't change between releases — they always point at `/releases/latest/download/<filename>`. The actual artifacts behind those URLs change when a new release is tagged.

---

## OAuth in-app behavior on iOS — known issue

The iOS TestFlight build's Sign in with Google currently kicks the user out to Safari instead of staying inside the app. Reproduces consistently as of 2026-05-07. Tracked under PROD-364 follow-up.

### Why it happens

`app/(public)/sign-in/page.tsx` calls `supabase.auth.signInWithOAuth({ provider: "google" })`. Under the hood Supabase does a top-level `window.location.href = <google url>`. Inside Capacitor's WKWebView this hits two issues simultaneously:

1. The Capacitor config has `server.allowNavigation: ["api.assemblyai.com", "layers.mirrorfactory.ai"]`. `accounts.google.com` is **not** allowlisted, so any navigation there is treated as external and punted to Safari by Capacitor's default policy.
2. Even if we allowlisted `accounts.google.com`, Google detects WebViews via `User-Agent` and refuses OAuth flows with `disallowed_useragent`. This is Google's anti-phishing rule and is non-negotiable.

### The standard fix (Capacitor + Supabase OAuth)

Three changes in the app code:

1. **Detect Capacitor at runtime** in `sign-in/page.tsx`. If running inside Capacitor:
   - Open the Google OAuth URL via `@capacitor/browser`'s `Browser.open({ url, presentationStyle: 'popover' })` instead of `window.location.href`. SFSafariViewController appears as an in-app overlay, leaves the app in the background, and is acceptable to Google for OAuth.
2. **Set `redirectTo` to the app's URL scheme** (`com.mirrorfactory.layers://auth/callback?code=…`). Google → Safari overlay → redirects to the scheme → iOS reopens the app with the code → Capacitor's `App.addListener('appUrlOpen', …)` handler grabs the URL and exchanges the code via `supabase.auth.exchangeCodeForSession(code)`.
3. **Add the redirect URL to Supabase project's allowlist** (Supabase dashboard → Authentication → URL Configuration → Redirect URLs): include `com.mirrorfactory.layers://auth/callback`.

This is a meaningful chunk of work — touches auth, scheme handling, and Supabase config — and isn't a quick fix. Sized like a small feature, not a hotfix. Same fix works for Android (with the Android scheme handler).

### Quick workaround for now

Users on iOS who hit this can sign in with email + password (`/sign-in` has both forms). Google sign-in stays Safari-bound until the deep-link OAuth is implemented.

---

## "How do I know which Windows .exe URL to put in the website?"

It's already in the website. The `/download` page reads from a constant (`GITHUB_RELEASE_DOWNLOAD_BASE`) plus a filename suffix. After the next tagged release, the Windows button resolves to:

```
https://github.com/mirror-factory/layers/releases/latest/download/Layers-windows.exe
```

You don't need to update any URL by hand. The `latest` segment auto-tracks whichever release is marked `--latest` (which the workflow does automatically via `gh release create … --latest`).

If you ever want to override it (Vercel edge cache, custom CDN, beta channel), the page also reads `NEXT_PUBLIC_WINDOWS_EXE_URL` from Vercel env first and falls back to the GitHub URL.

---

## Cheat sheet

```bash
# Ship a new release end-to-end
git checkout main
git pull
git tag v0.1.70           # convention: SemVer; chore commits already bumped package.json
git push --tags

# Watch CI
gh run watch --repo mirror-factory/layers

# Verify the GitHub Release was created
gh release view v0.1.70 --repo mirror-factory/layers

# Check TestFlight (after Apple processes it, ~5-15 min)
open "https://appstoreconnect.apple.com/apps/6767010089/distribution/ios/builds"
```

```bash
# Dry-run a build without publishing (manual workflow_dispatch)
gh workflow run build-release.yml --ref main -f include_apple_builds=true
```

```bash
# Bump version manually (the auto-hook usually handles this)
pnpm version patch        # 0.1.69 → 0.1.70
git push origin main --follow-tags
```
