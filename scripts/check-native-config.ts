#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

interface NativePolicy {
  mobileAppId?: string;
  deepLinkScheme?: string;
  oauthCallbackPath?: string;
  electronAppId?: string;
  artifactRoots?: string[];
}

interface ProjectProfile {
  nativePolicy?: NativePolicy;
}

interface Check {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  path?: string;
}

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");
const required = process.env.NATIVE_REQUIRED === "1";
const defaultMobileAppId = "com.mirafactory.layers";
const defaultElectronAppId = "com.mirafactory.layers";

function readOptional(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

function readProfile(): NativePolicy {
  const raw = readOptional(join(cwd, ".ai-dev-kit/project-profile.json"));
  if (!raw) return {};
  return (JSON.parse(raw) as ProjectProfile).nativePolicy ?? {};
}

function firstMatch(source: string | null, pattern: RegExp): string | null {
  if (!source) return null;
  return source.match(pattern)?.[1] ?? null;
}

function allMatches(source: string | null, pattern: RegExp): string[] {
  if (!source) return [];
  return Array.from(source.matchAll(pattern), match => match[1]).filter(Boolean);
}

function addCheck(checks: Check[], id: string, label: string, ok: boolean, pass: string, fail: string, path?: string) {
  checks.push({
    id,
    label,
    status: ok ? "pass" : required ? "fail" : "warn",
    detail: ok ? pass : fail,
    path,
  });
}

function hasDeepLink(source: string | null, scheme: string, callbackPath: string): boolean {
  if (!source) return false;
  return source.includes(`android:scheme="${scheme}"`) &&
    source.includes('android:host="auth"') &&
    source.includes(`android:path="${callbackPath}"`);
}

function listArtifacts(roots: string[]): Array<{ path: string; bytes: number; modifiedAt: string }> {
  const artifacts: Array<{ path: string; bytes: number; modifiedAt: string }> = [];

  function walk(path: string) {
    if (!existsSync(path)) return;
    const stat = statSync(path);
    if (stat.isFile()) {
      artifacts.push({
        path: path.startsWith(cwd) ? relative(cwd, path) : path,
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
      return;
    }
    if (!stat.isDirectory()) return;
    for (const entry of readdirSync(path)) walk(join(path, entry));
  }

  for (const root of roots) {
    walk(root.startsWith("/") ? root : join(cwd, root));
  }

  return artifacts
    .filter(file => /\.(apk|aab|ipa|dmg|exe|msi|zip)$/i.test(file.path))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, 500);
}

function main() {
  const policy = readProfile();
  const mobileAppId = policy.mobileAppId ?? defaultMobileAppId;
  const deepLinkScheme = policy.deepLinkScheme ?? mobileAppId;
  const callbackPath = policy.oauthCallbackPath ?? "/callback";
  const electronAppId = policy.electronAppId ?? defaultElectronAppId;
  const artifactRoots = process.env.RELEASE_ARTIFACT_ROOTS?.split(",").map(value => value.trim()).filter(Boolean) ??
    policy.artifactRoots ??
    ["dist-electron", "android/app/build/outputs", "ios/App/build", "release-assets"];

  const capacitorConfig = readOptional(join(cwd, "capacitor.config.ts"));
  const androidGradle = readOptional(join(cwd, "android/app/build.gradle"));
  const androidManifest = readOptional(join(cwd, "android/app/src/main/AndroidManifest.xml"));
  const iosProject = readOptional(join(cwd, "ios/App/App.xcodeproj/project.pbxproj"));
  const iosInfoPlist = readOptional(join(cwd, "ios/App/App/Info.plist"));
  const electronBuilder = readOptional(join(cwd, "electron-builder.yml"));
  const releaseWorkflow = readOptional(join(cwd, ".github/workflows/build-release.yml"));

  const checks: Check[] = [];
  const capAppId = firstMatch(capacitorConfig, /appId:\s*["']([^"']+)["']/);
  const capScheme = firstMatch(capacitorConfig, /scheme:\s*["']([^"']+)["']/);
  const androidNamespace = firstMatch(androidGradle, /namespace\s*=\s*["']([^"']+)["']/);
  const androidApplicationId = firstMatch(androidGradle, /applicationId\s+["']([^"']+)["']/);
  const iosBundleIds = Array.from(new Set(allMatches(iosProject, /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)));
  const workflowBundleId = firstMatch(releaseWorkflow, /PRODUCT_BUNDLE_IDENTIFIER=([A-Za-z0-9_.-]+)/);
  const electronBuilderAppId = firstMatch(electronBuilder, /^appId:\s*([^\n]+)/m);
  const macNotarizationGate = Boolean(
    releaseWorkflow?.includes("notarization_method") &&
    releaseWorkflow.includes("Refusing to publish a signed-but-unnotarized macOS app") &&
    releaseWorkflow.includes("spctl --assess --type execute"),
  );
  const androidSignedAabGate = Boolean(
    releaseWorkflow?.includes("LAYERS_ANDROID_KEYSTORE_BASE64") &&
    releaseWorkflow.includes("./gradlew :app:bundleRelease") &&
    releaseWorkflow.includes("Layers-android.aab"),
  );

  addCheck(checks, "native.profile-policy", "Native policy", Boolean(policy.mobileAppId), "Native policy is declared.", "Missing nativePolicy.mobileAppId; using fallback.", ".ai-dev-kit/project-profile.json");
  addCheck(checks, "native.capacitor-app-id", "Capacitor app id", capAppId === mobileAppId, `Capacitor appId is ${mobileAppId}.`, `Expected ${mobileAppId}, got ${capAppId ?? "missing"}.`, "capacitor.config.ts");
  addCheck(checks, "native.capacitor-scheme", "Capacitor iOS scheme", capScheme === deepLinkScheme, `Capacitor iOS scheme is ${deepLinkScheme}.`, `Expected ${deepLinkScheme}, got ${capScheme ?? "missing"}.`, "capacitor.config.ts");
  addCheck(checks, "native.android-namespace", "Android namespace", androidNamespace === mobileAppId, `Android namespace is ${mobileAppId}.`, `Expected ${mobileAppId}, got ${androidNamespace ?? "missing"}.`, "android/app/build.gradle");
  addCheck(checks, "native.android-application-id", "Android applicationId", androidApplicationId === mobileAppId, `Android applicationId is ${mobileAppId}.`, `Expected ${mobileAppId}, got ${androidApplicationId ?? "missing"}.`, "android/app/build.gradle");
  addCheck(checks, "native.android-oauth-deeplink", "Android OAuth deep link", hasDeepLink(androidManifest, deepLinkScheme, callbackPath), "Android manifest handles OAuth callback deep links.", `Missing ${deepLinkScheme}://auth${callbackPath} intent filter.`, "android/app/src/main/AndroidManifest.xml");
  addCheck(checks, "native.ios-bundle-id", "iOS bundle id", iosBundleIds.length > 0 && iosBundleIds.every(id => id === mobileAppId), `iOS bundle id is ${mobileAppId}.`, `Expected all bundle IDs to be ${mobileAppId}, got ${iosBundleIds.join(", ") || "missing"}.`, "ios/App/App.xcodeproj/project.pbxproj");
  addCheck(checks, "native.ios-url-scheme", "iOS OAuth URL scheme", !iosInfoPlist || iosInfoPlist.includes(`<string>${deepLinkScheme}</string>`), "Generated iOS Info.plist handles OAuth callback deep links or is not generated locally.", `Missing ${deepLinkScheme} URL type in generated iOS Info.plist.`, "ios/App/App/Info.plist");
  addCheck(checks, "native.release-workflow-bundle-id", "Release workflow bundle id", workflowBundleId === mobileAppId, `Release workflow uses ${mobileAppId}.`, `Expected ${mobileAppId}, got ${workflowBundleId ?? "missing"}.`, ".github/workflows/build-release.yml");
  addCheck(checks, "native.electron-app-id", "Electron app id", electronBuilderAppId === electronAppId, `Electron appId is ${electronAppId}.`, `Expected ${electronAppId}, got ${electronBuilderAppId ?? "missing"}.`, "electron-builder.yml");
  addCheck(checks, "native.macos-notarization-gate", "macOS notarization gate", macNotarizationGate, "Release workflow refuses signed-but-unnotarized macOS builds and verifies Gatekeeper acceptance.", "Release workflow does not prove macOS notarization before uploading artifacts.", ".github/workflows/build-release.yml");
  addCheck(checks, "native.android-signed-aab-gate", "Android signed AAB gate", androidSignedAabGate, "Release workflow can build and publish a signed Android AAB when upload-key secrets are present.", "Release workflow does not build a signed Android AAB for Play internal testing.", ".github/workflows/build-release.yml");

  const artifacts = listArtifacts(artifactRoots);
  checks.push({
    id: "native.release-artifacts-present",
    label: "Release artifacts",
    status: artifacts.length > 0 ? "pass" : "warn",
    detail: artifacts.length > 0 ? `${artifacts.length} release artifact(s) found.` : "No local release artifacts found yet.",
    path: artifactRoots.join(","),
  });

  const pass = checks.every(check => check.status !== "fail");
  mkdirSync(evidenceDir, { recursive: true });
  const out = join(evidenceDir, "native-config.json");
  writeFileSync(out, JSON.stringify({
    runAt: new Date().toISOString(),
    required,
    pass,
    mobileAppId,
    deepLinkScheme,
    callbackPath,
    artifactRoots,
    artifactCount: artifacts.length,
    artifacts,
    checks,
  }, null, 2) + "\n");

  for (const check of checks) {
    console.log(`[native-config] ${check.status}: ${check.label} -- ${check.detail}`);
  }
  console.log(`[native-config] wrote ${out}`);

  if (!pass) process.exit(1);
}

main();
