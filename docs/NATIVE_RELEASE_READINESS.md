# Native Release Readiness

Owner: Agent D, Native Release Prep
Last updated: 2026-04-30
Scope: iOS TestFlight and Google Play internal testing prep without Apple or Google account credentials.

Repository note: the root `.gitignore` ignores `/ios/` and `/android/`. Native changes in those directories exist on disk but will not appear in normal `git status`; commit them with an explicit force-add or update the ignore policy when native artifacts are meant to be tracked.

## Current Metadata

### iOS

| Field | Current value | Source |
| --- | --- | --- |
| Display name | `Layers` | `ios/App/App/Info.plist` |
| Bundle ID | `com.mirrorfactory.audiolayer` | `ios/App/App.xcodeproj/project.pbxproj`, `capacitor.config.ts` |
| Version | `1.0` | `MARKETING_VERSION` |
| Build | `1` | `CURRENT_PROJECT_VERSION` |
| Team ID | `36J9E4325G` | Xcode project signing settings |
| Deployment target | `15.0` | Xcode project build settings |
| Microphone copy | `Layers needs microphone access to record and transcribe your meetings.` | `Info.plist` |
| Privacy manifest | `ios/App/App/PrivacyInfo.xcprivacy` | Added to the app target resources |

The initial privacy manifest declares email address, user ID, audio data, and other user content as linked to the user, used for app functionality, and not used for tracking. Alfonso/legal still needs to reconcile this against App Store Connect App Privacy answers for calendar data, billing/subscription metadata, diagnostics, analytics, and any future third-party SDK manifests.

### Android

| Field | Current value | Source |
| --- | --- | --- |
| App label | `Layers` | `android/app/src/main/res/values/strings.xml` |
| Package/application ID | `com.mirrorfactory.audiolayer` | `android/app/build.gradle`, `AndroidManifest.xml` |
| Version name | `1.0` | `android/app/build.gradle` |
| Version code | `1` | `android/app/build.gradle` |
| Min SDK | `24` | `android/variables.gradle` |
| Compile/target SDK | `36` / `36` | `android/variables.gradle` |
| Release artifact | `android/app/build/outputs/bundle/release/app-release.aab` | Gradle `bundleRelease` |

## iOS TestFlight Path

Prerequisites Alfonso must complete:

- Apple Developer Program membership and App Store Connect access.
- App Store Connect app record for `Layers`.
- Bundle ID `com.mirrorfactory.audiolayer` registered under the Apple Developer team.
- Signing/provisioning access for team `36J9E4325G`, or update the Xcode project to the correct team ID.
- Final privacy policy URL, terms URL, support URL/email, app category, age rating, encryption/export compliance answer, and App Privacy nutrition labels.
- Account deletion and recording consent surfaces reviewed before wider TestFlight or App Review.

Before every upload, increment the build number from `1` to a new integer in Xcode or in `CURRENT_PROJECT_VERSION`.

Archive from CLI:

```bash
pnpm exec cap sync ios
mkdir -p build/ios
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$PWD/build/ios/Layers.xcarchive" \
  -allowProvisioningUpdates \
  clean archive
```

Upload directly to App Store Connect with an App Store Connect API key:

```bash
cat > /tmp/Layers-TestFlight-ExportOptions.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>upload</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>36J9E4325G</string>
  <key>uploadSymbols</key>
  <true/>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
  <key>testFlightInternalTestingOnly</key>
  <true/>
</dict>
</plist>
PLIST

xcodebuild \
  -exportArchive \
  -archivePath "$PWD/build/ios/Layers.xcarchive" \
  -exportPath "$PWD/build/ios/export" \
  -exportOptionsPlist /tmp/Layers-TestFlight-ExportOptions.plist \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$APP_STORE_CONNECT_API_KEY_PATH" \
  -authenticationKeyID "$APP_STORE_CONNECT_KEY_ID" \
  -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID"
```

Xcode UI alternative:

1. Open `ios/App/App.xcodeproj`.
2. Select scheme `App` and a generic iOS device destination.
3. Confirm signing team, bundle ID, version, and build.
4. Run `Product > Archive`.
5. In Organizer, select the archive and run `Validate App`.
6. Select `Distribute App > App Store Connect > Upload`.
7. Keep symbol upload enabled. Use `TestFlight Internal Testing Only` for the first internal build.
8. Wait for App Store Connect processing, then add the build to an internal TestFlight group.

App Store Connect tasks for Alfonso after upload:

- Create or select an internal tester group and add App Store Connect users.
- Add beta test information and release notes.
- Assign the processed build to the internal group.
- Complete App Privacy answers using the Xcode privacy report and final legal policy.
- Confirm encryption/export compliance.
- Add final screenshots, app description, keywords, category, support URL, privacy URL, and terms URL before App Review.

## Android Internal Testing Path

Release signing is configured in `android/app/build.gradle` from environment variables. Without all four variables, Gradle keeps the release build type unsigned.

Required signing environment:

```bash
export LAYERS_ANDROID_KEYSTORE_PATH="$HOME/.android/layers-upload.jks"
export LAYERS_ANDROID_KEYSTORE_PASSWORD="..."
export LAYERS_ANDROID_KEY_ALIAS="layers-upload"
export LAYERS_ANDROID_KEY_PASSWORD="..."
```

Create an upload keystore if Alfonso has not created one:

```bash
keytool -genkeypair \
  -v \
  -keystore "$HOME/.android/layers-upload.jks" \
  -storetype JKS \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias layers-upload
```

Do not commit the keystore or passwords. Back up the keystore in a password manager or secure vault.

Build the signed AAB:

```bash
pnpm exec cap sync android
cd android
./gradlew clean :app:bundleRelease
ls -lh app/build/outputs/bundle/release/app-release.aab
```

Play Console tasks for Alfonso:

- Create the Play app record for `Layers`.
- Confirm package name `com.mirrorfactory.audiolayer` before first upload; Google fixes the package name after the first artifact.
- Configure Play App Signing. Use the generated upload key for the AAB upload unless Alfonso has an existing app signing strategy.
- Complete app content requirements: Data Safety, privacy policy URL, content rating, target audience, ads declaration, and app access instructions.
- Go to `Testing > Internal testing`, create or select a tester email list, and add up to 100 testers.
- Create an internal testing release, upload `app-release.aab`, add release notes, review, and roll out.
- Share the Play internal testing opt-in link with testers after the release is available.

## Download URL Pattern

The public `/download` page uses stable GitHub Releases URLs for desktop and Android artifacts. In this repository, the current implementation builds each public link from the `mirror-factory/layers` release asset base:

```text
https://github.com/mirror-factory/layers/releases/latest/download
```

Older notes may refer to the legacy `mirror-factory/audio-layer` slug; the live `/download` fallback constant and release assets should stay aligned to `mirror-factory/layers` unless the repository moves again.

The stable URLs require these canonical asset names:

| Platform | Required release asset name | Public URL |
| --- | --- | --- |
| macOS Apple Silicon | `Layers-mac-arm64.dmg` | `https://github.com/mirror-factory/layers/releases/latest/download/Layers-mac-arm64.dmg` |
| macOS Intel | `Layers-mac-x64.dmg` | `https://github.com/mirror-factory/layers/releases/latest/download/Layers-mac-x64.dmg` |
| Windows | `Layers-windows.exe` | `https://github.com/mirror-factory/layers/releases/latest/download/Layers-windows.exe` |
| Android | `Layers-android.apk` | `https://github.com/mirror-factory/layers/releases/latest/download/Layers-android.apk` |

The `/releases/latest/download/<asset>` path is a GitHub redirect. It resolves to the asset with that exact filename on whichever GitHub Release is currently marked as the latest published release. It does not resolve to the newest GitHub Actions run, and it does not update from workflow artifacts unless those artifacts are promoted into a GitHub Release.

As of the 2026-05-01 PROD-382 clarification, the latest published release behind the stable URLs was `v0.1.21`. Check the repository's Releases page before publishing so the new tag moves `latest` forward from the current published release, not merely from the latest CI workflow run.

The current tag-push workflow in `.github/workflows/build-release.yml` has a `release` job that downloads workflow artifacts, renames them to these canonical filenames, and runs `gh release create ... --latest`, so no separate follow-up is needed for automatic release promotion on tag pushes. A manual `workflow_dispatch` build is different: it uploads run-specific workflow artifacts for inspection, but it does not publish a GitHub Release and therefore does not update the public `/releases/latest/download/...` links. A workflow artifact URL is tied to one run; a `/releases/latest/download/...` URL is tied to the latest published GitHub Release.

If the tag-push release job is unavailable, or if you need to publish from local build outputs, use the manual fallback:

1. Build or download the release artifacts from a trusted CI run.
2. Rename the artifacts exactly to the canonical names above.
3. Create a tag and GitHub Release, then upload the assets:

```bash
mkdir -p release-assets
cp path/to/mac-arm64-build.dmg release-assets/Layers-mac-arm64.dmg
cp path/to/mac-x64-build.dmg release-assets/Layers-mac-x64.dmg
cp path/to/windows-installer.exe release-assets/Layers-windows.exe
cp path/to/android-build.apk release-assets/Layers-android.apk

gh release create vX.Y.Z \
  --repo mirror-factory/layers \
  release-assets/Layers-mac-arm64.dmg \
  release-assets/Layers-mac-x64.dmg \
  release-assets/Layers-windows.exe \
  release-assets/Layers-android.apk \
  --title "Layers vX.Y.Z" \
  --generate-notes \
  --latest
```

GitHub dashboard alternative: open the repository's Releases page, draft a new release for the tag, attach the four files with the exact names above, publish the release, and confirm GitHub marks it as the latest release. After publication, test each `/releases/latest/download/...` URL before announcing the build.

[PROD-367](https://linear.app/mirror-factory/issue/PROD-367/wire-final-app-store-play-store-mac-windows-urls-into-download) wires the `/download` UI to these stable URLs. If the owner/repository slug changes, update the `/download` constant and this section together.

## Android Permissions And Recording Blocker

Current `AndroidManifest.xml` permissions:

- `android.permission.INTERNET`
- `android.permission.RECORD_AUDIO`
- `android.permission.MODIFY_AUDIO_SETTINGS`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.SCHEDULE_EXACT_ALARM`

No foreground recording service is implemented in `android/app/src/main/java`, and the manifest does not declare:

- `android.permission.FOREGROUND_SERVICE`
- `android.permission.FOREGROUND_SERVICE_MICROPHONE`
- A `<service>` with `android:foregroundServiceType="microphone"`

Blocker: if Android recording must continue while the app is backgrounded, screen-locked, or otherwise not visible, the app needs a real native foreground service with a persistent notification and microphone foreground service type. I did not add one because there is no existing native service pattern in the project. If recording is foreground-only inside the Capacitor WebView, the existing `RECORD_AUDIO` path may be enough, but it still needs physical-device testing for permission prompts, app switching, screen lock, incoming calls, and notification behavior.

## Targeted Checks

Run before handoff when local toolchains are available:

```bash
plutil -lint ios/App/App/PrivacyInfo.xcprivacy
xcodebuild -project ios/App/App.xcodeproj -list
cd android
./gradlew :app:assembleDebug
./gradlew :app:bundleRelease
```

`bundleRelease` requires the four `LAYERS_ANDROID_*` signing variables for a Play-ready signed artifact.

Current check results on 2026-04-30:

| Check | Result |
| --- | --- |
| `plutil -lint ios/App/App/PrivacyInfo.xcprivacy` | Pass |
| `plutil -lint ios/App/App/Info.plist` | Pass |
| `xcodebuild -project ios/App/App.xcodeproj -list` | Pass; scheme `App` is visible |
| `xmllint --noout android/app/src/main/AndroidManifest.xml` | Pass |
| `./gradlew :app:assembleDebug` | Blocked; local Java runtime is missing |
| `./gradlew :app:bundleRelease` | Blocked; local Java runtime is missing |

## Official References

- Apple: [Adding a privacy manifest to your app or third-party SDK](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk)
- Apple: [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files)
- Apple: [Distributing your app for beta testing and releases](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases/)
- Apple: [Add internal testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)
- Android: [Foreground service types are required](https://developer.android.com/about/versions/14/changes/fgs-types-required)
- Android: [Sign your app](https://developer.android.com/studio/publish/app-signing)
- Google Play: [Set up an open, closed, or internal test](https://support.google.com/googleplay/android-developer/answer/9845334)
