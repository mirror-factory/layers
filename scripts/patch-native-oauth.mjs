#!/usr/bin/env node
/**
 * Patch native projects with the `com.mirafactory.layers` URL-scheme
 * deep-link wiring required for Google OAuth (PROD-408) AND the per-platform
 * microphone permission strings required for live recording (PROD-476).
 *
 * Run AFTER `npx cap add <platform>` / `npx cap sync` because both
 * `ios/` and `android/` are gitignored — Capacitor regenerates them
 * on every CI build. This script makes the regenerated projects match
 * the in-app OAuth + recording contracts:
 *
 *   - iOS:
 *       * add `com.mirafactory.layers` to `CFBundleURLSchemes` in
 *         `ios/App/App/Info.plist` (PROD-408)
 *       * add `NSMicrophoneUsageDescription` so iOS shows the first-tap
 *         permission prompt with human-readable copy (PROD-476)
 *   - Android:
 *       * add a deep-link `<intent-filter>` to MainActivity in
 *         `android/app/src/main/AndroidManifest.xml` (PROD-408)
 *       * ensure `<uses-permission android:name="android.permission.RECORD_AUDIO" />`
 *         is present (PROD-476; Capacitor's default template already
 *         includes it, but we re-assert idempotently in case a future
 *         Capacitor template drops it).
 *
 * Idempotent. Safe to re-run.
 *
 * Usage:
 *   node scripts/patch-native-oauth.mjs            # patch both platforms
 *   node scripts/patch-native-oauth.mjs --ios      # ios only
 *   node scripts/patch-native-oauth.mjs --android  # android only
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const URL_SCHEME = "com.mirafactory.layers";
const LEGACY_SCHEME = "layers";

// PROD-476: human-readable microphone usage copy shown in the iOS first-tap
// prompt. Keep this terse and explanatory — App Review rejects vague strings.
const MIC_USAGE_DESCRIPTION =
  "Layers needs your microphone to record meetings and transcribe what's said. Audio is captured only while you're recording.";

const args = new Set(process.argv.slice(2));
const wantAll = args.size === 0;
const wantIos = wantAll || args.has("--ios");
const wantAndroid = wantAll || args.has("--android");

function log(msg) {
  process.stdout.write(`[patch-native-oauth] ${msg}\n`);
}

function patchIosUrlSchemes(original) {
  if (
    original.includes(`<string>${URL_SCHEME}</string>`) &&
    /<key>CFBundleURLTypes<\/key>/.test(original)
  ) {
    log("ios: CFBundleURLTypes already contains com.mirafactory.layers — skipping URL schemes");
    return original;
  }

  const urlTypesXml = `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>${URL_SCHEME}</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${LEGACY_SCHEME}</string>\n\t\t\t\t<string>${URL_SCHEME}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n`;

  let next;
  if (/<key>CFBundleURLTypes<\/key>/.test(original)) {
    next = original.replace(
      /\t?<key>CFBundleURLTypes<\/key>\s*<array>[\s\S]*?<\/array>\s*/,
      urlTypesXml,
    );
  } else {
    next = original.replace(/<\/dict>\s*<\/plist>/, `${urlTypesXml}</dict>\n</plist>`);
  }

  if (next === original) {
    log("ios: nothing to patch (no CFBundleURLTypes block written)");
    return original;
  }
  log("ios: injected CFBundleURLTypes for OAuth deep-link");
  return next;
}

function patchIosMicrophoneUsage(original) {
  if (/<key>NSMicrophoneUsageDescription<\/key>/.test(original)) {
    log(
      "ios: NSMicrophoneUsageDescription already present — skipping mic usage string",
    );
    return original;
  }

  const usageXml = `\t<key>NSMicrophoneUsageDescription</key>\n\t<string>${MIC_USAGE_DESCRIPTION}</string>\n`;

  // Insert before the final </dict></plist> close.
  const next = original.replace(
    /<\/dict>\s*<\/plist>/,
    `${usageXml}</dict>\n</plist>`,
  );

  if (next === original) {
    log("ios: failed to inject NSMicrophoneUsageDescription (anchor not found)");
    process.exitCode = 1;
    return original;
  }
  log("ios: injected NSMicrophoneUsageDescription");
  return next;
}

function patchIos() {
  const plistPath = path.join(ROOT, "ios", "App", "App", "Info.plist");
  if (!fs.existsSync(plistPath)) {
    log(`skip ios: ${plistPath} not found`);
    return;
  }
  const original = fs.readFileSync(plistPath, "utf8");
  const afterSchemes = patchIosUrlSchemes(original);
  const afterMic = patchIosMicrophoneUsage(afterSchemes);

  if (afterMic === original) {
    return;
  }

  fs.writeFileSync(plistPath, afterMic, "utf8");
  log(`ios: patched ${path.relative(ROOT, plistPath)}`);
}

function patchAndroidOauthFilter(original) {
  if (original.includes(`android:scheme="${URL_SCHEME}"`)) {
    log("android: AndroidManifest already contains scheme — skipping OAuth filter");
    return original;
  }

  const intentFilter = `\n            <!--\n              PROD-408: Native Google OAuth deep-link. Patched by\n              scripts/patch-native-oauth.mjs after \`cap sync\`.\n            -->\n            <intent-filter android:autoVerify="false">\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="${URL_SCHEME}" />\n            </intent-filter>\n`;

  const launcherFilter = /(<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN" \/>\s*<category android:name="android\.intent\.category\.LAUNCHER" \/>\s*<\/intent-filter>)/;
  if (!launcherFilter.test(original)) {
    log("android: MainActivity launcher intent-filter not found — bailing without patching OAuth filter");
    process.exitCode = 1;
    return original;
  }
  log("android: injected OAuth deep-link intent-filter");
  return original.replace(launcherFilter, `$1${intentFilter}`);
}

function patchAndroidMicPermission(original) {
  if (
    /uses-permission\s+android:name="android\.permission\.RECORD_AUDIO"/.test(
      original,
    )
  ) {
    log("android: RECORD_AUDIO already declared — skipping mic permission");
    return original;
  }

  const permission = `\n    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n`;

  // Prefer to insert next to existing uses-permission entries; fall back to
  // just before </manifest> if none exist.
  if (/<uses-permission /.test(original)) {
    const next = original.replace(
      /(<uses-permission [^>]*\/>)([\s\S]*?)(?=<\/manifest>)/,
      `$1$2${permission}`,
    );
    if (next !== original) {
      log("android: injected RECORD_AUDIO permission");
      return next;
    }
  }

  const next = original.replace(
    /<\/manifest>/,
    `${permission}</manifest>`,
  );
  if (next === original) {
    log("android: failed to inject RECORD_AUDIO (no </manifest> anchor)");
    process.exitCode = 1;
    return original;
  }
  log("android: injected RECORD_AUDIO permission");
  return next;
}

function patchAndroid() {
  const manifestPath = path.join(
    ROOT,
    "android",
    "app",
    "src",
    "main",
    "AndroidManifest.xml",
  );
  if (!fs.existsSync(manifestPath)) {
    log(`skip android: ${manifestPath} not found`);
    return;
  }
  const original = fs.readFileSync(manifestPath, "utf8");
  const afterOauth = patchAndroidOauthFilter(original);
  const afterMic = patchAndroidMicPermission(afterOauth);

  if (afterMic === original) {
    return;
  }

  fs.writeFileSync(manifestPath, afterMic, "utf8");
  log(`android: patched ${path.relative(ROOT, manifestPath)}`);
}

if (wantIos) patchIos();
if (wantAndroid) patchAndroid();
