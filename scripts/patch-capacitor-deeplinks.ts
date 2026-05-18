#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface NativePolicy {
  mobileAppId?: string;
  deepLinkScheme?: string;
  oauthCallbackPath?: string;
}

interface ProjectProfile {
  nativePolicy?: NativePolicy;
}

const cwd = process.cwd();
const profilePath = join(cwd, ".ai-dev-kit/project-profile.json");
const evidenceDir = join(cwd, ".evidence");
const defaultScheme = "com.mirafactory.layers";

function readOptional(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

function readProfile(): NativePolicy {
  const raw = readOptional(profilePath);
  if (!raw) return {};
  return (JSON.parse(raw) as ProjectProfile).nativePolicy ?? {};
}

function writeEvidence(changes: Array<{ path: string; changed: boolean; detail: string }>) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, "native-deeplink-patch.json"), JSON.stringify({
    runAt: new Date().toISOString(),
    changes,
  }, null, 2) + "\n");
}

function patchAndroidManifest(path: string, scheme: string, callbackPath: string) {
  const source = readOptional(path);
  if (!source) return { path, changed: false, detail: "Android manifest not present." };
  if (source.includes(`android:scheme="${scheme}"`)) {
    return { path, changed: false, detail: "Android OAuth deep-link scheme already present." };
  }

  const intentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${scheme}" android:host="auth" android:path="${callbackPath}" />
            </intent-filter>`;

  const marker = `            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>`;

  const next = source.includes(marker)
    ? source.replace(marker, `${marker}\n${intentFilter}`)
    : source.replace("</activity>", `${intentFilter}\n        </activity>`);

  writeFileSync(path, next);
  return { path, changed: true, detail: `Inserted Android OAuth deep-link scheme ${scheme}.` };
}

function patchIosInfoPlist(path: string, scheme: string) {
  const source = readOptional(path);
  if (!source) return { path, changed: false, detail: "iOS Info.plist not present." };
  if (source.includes(`<string>${scheme}</string>`)) {
    return { path, changed: false, detail: "iOS OAuth URL scheme already present." };
  }

  const block = `
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${scheme}</string>
			</array>
		</dict>
	</array>`;

  const next = source.replace("</dict>\n</plist>", `${block}\n</dict>\n</plist>`);
  writeFileSync(path, next);
  return { path, changed: true, detail: `Inserted iOS OAuth URL scheme ${scheme}.` };
}

function replaceOrWrite(path: string, pattern: RegExp, replacement: string, label: string) {
  const source = readOptional(path);
  if (!source) return { path, changed: false, detail: `${label} file not present.` };
  const next = source.replace(pattern, replacement);
  if (next === source) return { path, changed: false, detail: `${label} already aligned or pattern not found.` };
  writeFileSync(path, next);
  return { path, changed: true, detail: `${label} aligned.` };
}

function main() {
  const policy = readProfile();
  const mobileAppId = policy.mobileAppId ?? defaultScheme;
  const scheme = policy.deepLinkScheme ?? mobileAppId;
  const callbackPath = policy.oauthCallbackPath ?? "/callback";
  const changes = [
    patchAndroidManifest(join(cwd, "android/app/src/main/AndroidManifest.xml"), scheme, callbackPath),
    patchIosInfoPlist(join(cwd, "ios/App/App/Info.plist"), scheme),
    replaceOrWrite(
      join(cwd, "android/app/build.gradle"),
      /(namespace = "|applicationId ")([^"]+)(")/g,
      `$1${mobileAppId}$3`,
      "Android application id",
    ),
    replaceOrWrite(
      join(cwd, "ios/App/App.xcodeproj/project.pbxproj"),
      /(PRODUCT_BUNDLE_IDENTIFIER = )[^;]+(;)/g,
      `$1${mobileAppId}$2`,
      "iOS bundle id",
    ),
  ];

  writeEvidence(changes);
  for (const change of changes) {
    console.log(`[native-deeplink-patch] ${change.changed ? "changed" : "ok"} ${change.path} -- ${change.detail}`);
  }
}

main();
