# iOS Focused Auth QA Report

Date: 2026-05-18
Branch: `release/external-tester-readiness-2026-05-17`
App ID target: `com.mirafactory.layers`

## Summary

iOS auth is not release-proven yet.

The production-configured simulator build launched and reached the Layers sign-in screen, but tapping **Continue with Google** did not complete the expected in-app/browser OAuth path during the observed window. The app remained on the Google button loading state after the Maestro flow and after an additional screenshot check.

The local-current patch changes native OAuth handling so the UI no longer depends on Capacitor Browser resolving immediately. A localhost iOS build confirmed the app no longer pins the Google button indefinitely, but localhost does not have the required public Supabase browser env, so full OAuth cannot be proven from that run.

Email/password sign-in was also not accepted as passing evidence. The iOS keyboard/focus path appended password input into the email field during the automated flow. Screenshots containing the visible test credential were deleted.

## Evidence

- `ios-walk-I2-google-oauth-screen.png`: production iOS Google auth observed on the sign-in screen.
- `ios-google-oauth-after-12s.png`: production iOS still showing the Google loading state after the observed wait.
- `ios-local-current-launch.png`: local-current build launched against localhost.
- `ios-local-current-google-after-12s.png`: local-current build surfaced local auth configuration instead of indefinite loading.

## Local Fixes Applied

- `components/native-auth-bridge.tsx`: native deep-link listener now derives the scheme/host/path from `NATIVE_OAUTH_REDIRECT_URL` instead of the stale `com.mirrorfactory.layers` value.
- `scripts/run-native-smoke.ts`: default `MAESTRO_APP_ID` corrected to `com.mirafactory.layers`.
- `lib/auth/native-oauth.ts`: native Google OAuth no longer blocks the caller indefinitely when `Browser.open()` stays pending while the browser owns the flow.
- `tests/native-oauth.test.ts`: updated coverage for pending `Browser.open()` behavior and immediate browser-open failures.

## Decision

Block external iOS tester release until a production-like build with public Supabase env proves:

1. Google sign-in opens the native browser or in-app browser correctly.
2. OAuth returns to `com.mirafactory.layers://auth/callback`.
3. The app exchanges the session and lands signed in.
4. Email/password focus routes typed input into the correct fields.

