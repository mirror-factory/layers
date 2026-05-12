# Recording — Manual Real-Device QA

Tracks: [PROD-477](https://linear.app/mirror-factory/issue/PROD-477)

> Companion docs: [RECORDING_RELIABILITY.md](./RECORDING_RELIABILITY.md), [RELEASE.md](./RELEASE.md), [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md)

Automated tests can verify code paths but not actual microphone capture quality on real hardware. **This doc is the human checklist that runs before each major release — promote nothing to production without all these rows green.**

Linked from `docs/RELEASE.md` as a pre-promotion gate.

---

## When to run

- **Before every promotion to `main`** (release-flow pre-promotion gate).
- After any change to: `components/live-recorder.tsx`, `lib/recording/**`, `app/api/transcribe/**`, microphone permission flow, or AssemblyAI/Deepgram adapter.
- After native build pipeline changes (PROD-364 iOS, PROD-365 Android, PROD-366 Desktop).
- Once per quarter regardless, to catch silent drift (vendor SDK changes, OS updates).

---

## Devices in scope

| Device | Build path | Owner | Last verified |
|---|---|---|---|
| iPhone 15 Pro | TestFlight (PROD-364 pipeline) | @alfonso | — |
| Pixel 8 Pro | Signed APK (PROD-365 pipeline) | @alfonso | — |
| Mac (M-series) | Electron build (PROD-366 pipeline) | @alfonso | — |
| Chrome desktop (latest) | layers.mirrorfactory.ai | @alfonso | — |
| Safari desktop (latest) | layers.mirrorfactory.ai | @alfonso | — |

Add more rows when expanding to additional supported devices (iPad Pro, Galaxy S24, Firefox).

---

## Per-device checklist

Run **every row** on every device. For each row record:
- `[x]` pass / `[~]` partial / `[ ]` not yet / `[!]` fail
- Date verified
- Device firmware / browser version
- Screenshot or short clip evidence (drop into `.ai-starter/evidence/manual-qa/<device>/<YYYY-MM-DD>/`)

### Pre-flight

| # | Check | Expected | Notes |
|---|---|---|---|
| 1 | App opens to `/record` without errors | landing/recorder visible within 2s, no console errors | — |
| 2 | Existing user can sign in | Google OAuth flow stays in-app on native, returns to recorder | PROD-408 verification |
| 3 | Status bar / dynamic island / notch don't overlap content | content respects safe-area-top | PROD-460 verification |

### Permission flow

| # | Check | Expected | Notes |
|---|---|---|---|
| 4 | First tap on Start triggers mic permission prompt | System dialog appears with our `NSMicrophoneUsageDescription` copy on iOS, "Allow Layers to record audio?" on Android | PROD-476 |
| 5 | Allow → recording starts within ~1s | Wave ribbon animates, status badge shows "Listening" | — |
| 6 | Deny → clear error UI | Inline message: "Allow microphone access in Settings to record." On native, a deep-link button opens Settings directly | PROD-476 |
| 7 | After Deny then Allow via Settings, return to app | Tapping Start works without re-prompt within 5s | — |

### Recording quality

| # | Check | Expected | Notes |
|---|---|---|---|
| 8 | Speak naturally for 30s | Partial transcripts appear within ~1.5s of speaking | — |
| 9 | Pause mid-recording (don't stop) | Status stays "Listening" or transitions to "Transcribing" briefly | — |
| 10 | Final transcript turns appear at end-of-utterance | Each sentence finalizes within 2s of pause | — |
| 11 | Tap Stop / Finalize | Status transitions: finalizing → done. Meeting card shows complete transcript | — |
| 12 | Transcript matches what was said | ≥ 90% word accuracy on clean speech, ≥ 75% on accented or fast speech | Subjective; note any systematic errors |

### Reliability edge cases

| # | Check | Expected | Notes |
|---|---|---|---|
| 13 | Lock the device mid-recording (iOS/Android only) | Recording continues in background OR stops cleanly with toast (depending on plan tier) | Document actual behavior |
| 14 | Receive a phone call mid-recording | Recording pauses cleanly; transcript captured up to interrupt; resumable | — |
| 15 | Network drops for 5s mid-recording | UI shows "Reconnecting" state; local draft preserved; on reconnect, transcription resumes without losing utterances | RECORDING_RELIABILITY §"Session States" |
| 16 | App backgrounded + foregrounded after 30s | Recording continues OR resumes cleanly. No duplicate transcript segments | — |
| 17 | Close app mid-recording, reopen, navigate to `/meetings/[id]` | "Recovered from local draft" banner visible; can finalize manually | PROD-475 |

### Storage + finalize

| # | Check | Expected | Notes |
|---|---|---|---|
| 18 | 30-min recording uploads + finalizes | Storage-backed upload path (>4.5MB) succeeds; summary generated | PROD-473 |
| 19 | Audio file appears in Supabase Storage | Signed URL works for playback within UI | — |
| 20 | Meeting summary card populates | Action items, decisions, key points filled from real transcript | — |
| 21 | Chat works at meeting detail | Ask "What did we decide?" → relevant answer with citations | PROD-461 + 464 |

### Post-recording UX

| # | Check | Expected | Notes |
|---|---|---|---|
| 22 | Citations clickable | `[S12]` pill seeks transcript pane + highlights | PROD-464 |
| 23 | Onboarding tour fires for first-time user only | Welcome modal + 3-step coachmarks appear; dismissable; doesn't re-fire | PROD-389 |
| 24 | Settings → Integrations renders | No 500, empty state if no connections | PROD-403 |

---

## Aggregate pass/fail per device

Add a row each time a full pass is run:

| Date | Device | Build version | Tester | Result | Notes |
|---|---|---|---|---|---|
| _(none yet)_ | | | | | |

---

## When a row fails

1. **Record evidence:** screenshot or screen recording of the failure into `.ai-starter/evidence/manual-qa/<device>/<YYYY-MM-DD>/`.
2. **File a Linear ticket** with `kind:bug` label, link this doc, paste the evidence.
3. **Triage by severity:**
   - Recording quality regression (rows 8-12) → P1, blocks release.
   - Reliability edge case fail (rows 13-17) → P1-P2 depending on user impact.
   - Cosmetic / UX (rows 23-24) → P3.
4. **Block release** if any P0/P1 fails on more than one device.

---

## Promotion criteria

Release to `main` may proceed when:

- [ ] All 5 devices have a fresh pass dated within the last 7 days.
- [ ] No `[!]` rows on any device.
- [ ] Any `[~]` partial rows have a documented reason (e.g. "platform doesn't support this — accepted").
- [ ] Evidence directory exists with at least one screenshot per device.

If criteria aren't met but a critical fix needs to ship anyway, document the override reason in the release PR description and link it from `docs/RELEASE.md`.

---

_Last updated: 2026-05-12. Owner: @alfonso. Maintained by: any agent touching `lib/recording/**` or `app/api/transcribe/**`._
