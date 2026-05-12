#!/usr/bin/env node
/**
 * Patch native projects with the `com.mirrorfactory.layers` URL-scheme
 * deep-link wiring required for Google OAuth (PROD-408).
 *
 * Run AFTER `npx cap add <platform>` / `npx cap sync` because both
 * `ios/` and `android/` are gitignored — Capacitor regenerates them
 * on every CI build. This script makes the regenerated projects match
 * the in-app OAuth contract:
 *
 *   - iOS:  add `com.mirrorfactory.layers` to `CFBundleURLSchemes` in
 *           `ios/App/App/Info.plist` (also the legacy `layers` scheme).
 *   - Android: add a deep-link `<intent-filter>` to MainActivity in
 *           `android/app/src/main/AndroidManifest.xml`.
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
const URL_SCHEME = "com.mirrorfactory.layers";
const LEGACY_SCHEME = "layers";

const args = new Set(process.argv.slice(2));
const wantAll = args.size === 0;
const wantIos = wantAll || args.has("--ios");
const wantAndroid = wantAll || args.has("--android");

function log(msg) {
  process.stdout.write(`[patch-native-oauth] ${msg}\n`);
}

function patchIos() {
  const plistPath = path.join(ROOT, "ios", "App", "App", "Info.plist");
  if (!fs.existsSync(plistPath)) {
    log(`skip ios: ${plistPath} not found`);
    return;
  }
  const original = fs.readFileSync(plistPath, "utf8");

  if (
    original.includes(`<string>${URL_SCHEME}</string>`) &&
    /<key>CFBundleURLTypes<\/key>/.test(original)
  ) {
    log("ios: CFBundleURLTypes already contains com.mirrorfactory.layers — skipping");
    return;
  }

  const urlTypesXml = `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>${URL_SCHEME}</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${LEGACY_SCHEME}</string>\n\t\t\t\t<string>${URL_SCHEME}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n`;

  let next;
  if (/<key>CFBundleURLTypes<\/key>/.test(original)) {
    // Replace existing CFBundleURLTypes block with our canonical one.
    next = original.replace(
      /\t?<key>CFBundleURLTypes<\/key>\s*<array>[\s\S]*?<\/array>\s*/,
      urlTypesXml,
    );
  } else {
    // Insert before the final </dict></plist> close.
    next = original.replace(/<\/dict>\s*<\/plist>/, `${urlTypesXml}</dict>\n</plist>`);
  }

  if (next === original) {
    log("ios: nothing to patch (no CFBundleURLTypes block written)");
    return;
  }

  fs.writeFileSync(plistPath, next, "utf8");
  log(`ios: patched ${path.relative(ROOT, plistPath)}`);
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

  if (original.includes(`android:scheme="${URL_SCHEME}"`)) {
    log("android: AndroidManifest already contains scheme — skipping");
    return;
  }

  const intentFilter = `\n            <!--\n              PROD-408: Native Google OAuth deep-link. Patched by\n              scripts/patch-native-oauth.mjs after \`cap sync\`.\n            -->\n            <intent-filter android:autoVerify="false">\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="${URL_SCHEME}" />\n            </intent-filter>\n`;

  // Insert the new intent-filter just before MainActivity's closing </activity>.
  // We anchor on the MainActivity intent-filter that already exists in the
  // generated manifest to avoid accidentally injecting into a sibling activity.
  const launcherFilter = /(<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN" \/>\s*<category android:name="android\.intent\.category\.LAUNCHER" \/>\s*<\/intent-filter>)/;
  if (!launcherFilter.test(original)) {
    log("android: MainActivity launcher intent-filter not found — bailing without patching");
    process.exitCode = 1;
    return;
  }
  const next = original.replace(launcherFilter, `$1${intentFilter}`);
  fs.writeFileSync(manifestPath, next, "utf8");
  log(`android: patched ${path.relative(ROOT, manifestPath)}`);
}

if (wantIos) patchIos();
if (wantAndroid) patchAndroid();
