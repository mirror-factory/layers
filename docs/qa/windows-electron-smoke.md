# Windows Electron Smoke Runbook

Owner: Release QA
Status: Deferred until a Windows host and Authenticode signing certificate are available.
Ticket: PROD-506

Use this runbook for the first Windows Electron smoke pass. It intentionally
does not mark any row as passed from Linux or macOS. The pass log is valid only
when executed on a real Windows host, Windows VM, or `windows-latest` runner
with the required signing material available.

## Required Host

- Windows 11 or Windows 10 build 19041 or later.
- Node 20 or later.
- pnpm 10 or later.
- Java 21 when Android/native shared tooling is invoked by the verification
  path.
- Repo checkout on the QA branch or release candidate commit.
- Optional but required for signing verdicts: EV or OV Authenticode
  certificate exported as a `.pfx`.

## Signing Prerequisites

The current Windows signing state is placeholder-only. Before marking WIN1,
WIN2, or WIN8 as passed:

- Add `WINDOWS_CSC_LINK` as a base64-encoded `.pfx` GitHub secret.
- Add `WINDOWS_CSC_KEY_PASSWORD` as the `.pfx` password GitHub secret.
- Wire those secrets into the `electron-windows` job in
  `.github/workflows/build-release.yml`.
- Uncomment the `win.signtoolOptions` block in `electron-builder.yml`, or
  replace it with the final `electron-builder` signing path.
- Use an RFC 3161 timestamp server, for example
  `http://timestamp.digicert.com`.

EV certificates are expected to avoid first-install SmartScreen reputation
warnings. OV certificates can sign the installer but may still need reputation
history before SmartScreen stops warning.

## Setup

Run from a clean checkout:

```powershell
node --version
pnpm --version
java -version
pnpm install --frozen-lockfile
pnpm test:native:config
pnpm electron:build
```

Expected build output:

- `dist-electron/*.exe` exists.
- The installer filename matches the current app version.
- `.evidence/native-config.json` is current if `pnpm test:native:config` ran.
- `.evidence/release-artifacts.json` is current if release artifact validation
  ran.

## A. Build, Install, Launch

| Row | Check | Expected result | Evidence |
| --- | --- | --- | --- |
| A1 | `pnpm electron:build` | NSIS installer is produced in `dist-electron/`. | Terminal log and `dir dist-electron` screenshot or text capture. |
| A2 | Run NSIS installer | Installer completes cleanly and places shortcuts on Desktop and Start menu. | Installer screen recording and shortcut screenshot. |
| A3 | Launch from Start menu | Main app window appears in under 3 seconds. | Video with visible clock or timer. |
| A4 | Taskbar icon | Layers icon appears in the taskbar while running. | Screenshot. |
| A5 | Window controls | Standard Windows chrome exposes minimize, maximize, and close controls. | Screenshot or video. |
| A6 | Close and relaunch | App relaunches and expected local state persists. | Before/after video or screenshots. |

## B-M. Windows Parity Matrix

Mirror the macOS smoke rows with Windows-specific behavior. Do not carry over
macOS-only expectations such as Gatekeeper, notarization, or traffic-light
window controls.

| Section | Windows checks | Expected result | Evidence |
| --- | --- | --- | --- |
| B. First-run shell | Launch from installer, Start menu, Desktop shortcut, and direct `.exe`. | App opens consistently without duplicate windows or shell errors. | Video. |
| C. Authentication | Sign in and sign out using the supported auth path. | Browser/auth flow returns to the Electron app or documented web fallback. | Video with secrets hidden. |
| D. Recording entry | Open `/record`, `/record/live`, and upload flow inside Electron. | Routes render, controls are enabled, and no Electron-specific console errors appear. | Screenshots and console capture. |
| E. Microphone permission | Start a microphone recording. | Windows privacy prompt/settings allow the app to request and receive mic input. | Screenshot of prompt/settings and recording state. |
| F. Live transcript | Exercise live recording long enough to receive transcript activity, or document provider-secret blocker. | Transcript state updates or blocked provider dependency is recorded. | Video and logs. |
| G. File upload | Use the upload path with Windows Explorer file picker. | Native Windows dialog opens and accepted audio file proceeds to the next state. | Video. |
| H. Meetings workspace | Open meetings list/detail/search surfaces. | Existing web app behavior works inside Electron. | Screenshots. |
| I. Offline/error states | Disable network or force an expected provider error. | User-facing error state is readable and app remains responsive. | Screenshot and logs. |
| J. Persistence | Close, relaunch, and revisit recent state. | Session/local state behavior matches web/macOS expectations for the same account. | Before/after screenshots. |
| K. Updates/downloads | Validate update or download behavior for the current release channel. | No broken update prompts or stale download links. | Screenshot/logs. |
| L. Accessibility/basic keyboard | Tab through primary controls and activate window controls with keyboard/mouse. | Focus is visible; controls are reachable. | Video. |
| M. Exit/uninstall | Quit from window close and uninstall from Windows Apps or Start menu. | Process exits cleanly; uninstall removes installed shortcuts. | Task Manager/process screenshot and uninstall video. |

## Windows-Only Extras

| Row | Check | Expected result | Evidence |
| --- | --- | --- | --- |
| WIN1 | SmartScreen | Installer does not trigger SmartScreen. Requires EV cert for a strong pass. | Install video. |
| WIN2 | Authenticode signature and timestamp | `Get-AuthenticodeSignature` reports `Valid`; timestamp is present. | PowerShell output. |
| WIN3 | Toast notifications | Windows Action Center receives expected app toast notifications when that feature is available. | Screenshot/video. |
| WIN4 | Chromium parity | Electron Chromium behavior matches supported web behavior; Edge WebView2 is not required. | Version capture and smoke video. |
| WIN5 | Windows Hello | If Windows Hello sign-in is supported, it completes; otherwise mark not applicable with linked product ticket. | Video or N/A note. |
| WIN6 | File picker | Upload flow uses the native Windows file dialog. | Video. |
| WIN7 | Mic privacy settings | Windows Privacy & security > Microphone lists/allows Layers and recording works. | Settings screenshot. |
| WIN8 | Auto-update via NSIS publisher | Update channel detects publisher-signed installer when auto-update is enabled. | Update log and video. |

## Evidence Capture Rules

- Capture screenshots as PNG and videos as MP4 or WebM.
- Save artifacts under the proof packet or release QA artifact path for the
  ticket/release under test.
- Record the exact commit SHA, installer filename, Windows version, and
  certificate type in the pass log.
- File a separate Linear bug for each failed row. Include row ID, expected
  behavior, actual behavior, artifact links, commit SHA, and whether the issue
  blocks release.
- Do not mark signing or SmartScreen rows as passed for unsigned installers.
- Do not mark native-device/Tier 5 proof as passed from Playwright, Linux CI, or
  browser-only smoke output.

## Pass Log

| Row | Date | Status | Screenshot | Video | Brand verdict | Linear bug if failed |
| --- | --- | --- | --- | --- | --- | --- |
| Pending Windows host |  | Blocked |  |  |  |  |
