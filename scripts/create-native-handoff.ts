#!/usr/bin/env tsx
/**
 * Creates the external native/device proof handoff packet.
 *
 * This packet is intentionally not device proof. It explains which runner must
 * execute the app, which command to run there, and which artifacts must be
 * copied back before a native lane can turn green.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { arch, platform, release } from "node:os";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

type JsonObject = Record<string, unknown>;

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");
const profilePath = join(cwd, ".ai-dev-kit", "project-profile.json");
const out = join(evidenceDir, "native-device-handoff.json");

function readJson(path: string): JsonObject | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as JsonObject;
  } catch {
    return null;
  }
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function splitIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function taskIds(branch: string | null): string[] {
  const explicit = unique([
    ...splitIds(process.env.AI_DEV_KIT_TASK_IDS),
    ...splitIds(process.env.SYMPHONY_TASK_IDS),
    process.env.AI_DEV_KIT_TASK_ID,
    process.env.LINEAR_TASK_ID,
    process.env.LINEAR_ISSUE_ID,
    process.env.LINEAR_IDENTIFIER,
    process.env.SYMPHONY_TASK_ID,
    process.env.SYMPHONY_TICKET_ID,
    process.env.TICKET_ID,
    process.env.ISSUE_ID,
    process.env.TASK_ID,
  ]);
  if (explicit.length) return explicit;
  const inferred = Array.from(new Set((branch ?? "").match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []));
  return inferred.length ? inferred : branch?.startsWith("agent/") ? [branch] : [];
}

function checksumFile(path: string, bytes: number): string | null {
  if (bytes > 128 * 1024 * 1024) return null;
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function listFiles(root: string): Array<{ path: string; bytes: number; modifiedAt: string; checksum: string | null }> {
  const fullRoot = join(cwd, root);
  const files: Array<{ path: string; bytes: number; modifiedAt: string; checksum: string | null }> = [];
  if (!existsSync(fullRoot)) return files;

  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = statSync(full);
      files.push({
        path: relative(cwd, full),
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        checksum: checksumFile(full, stat.size),
      });
    }
  }

  walk(fullRoot);
  return files;
}

function enabledNativePlatforms(): string[] {
  const profile = readJson(profilePath) as { platforms?: Record<string, { enabled?: boolean }> } | null;
  if (!profile?.platforms) return [];
  return Object.entries(profile.platforms)
    .filter(([name, config]) => Boolean(config?.enabled) && ["ios", "android", "macos", "windows"].includes(name))
    .map(([name]) => name);
}

function envOrDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function packetState(...payloads: Array<JsonObject | null>): "ready" | "pending" | "blocked" {
  if (payloads.some((payload) => payload?.pass === false && payload?.required === true)) return "blocked";
  if (payloads.some((payload) => payload?.pass === true && payload?.skipped !== true)) return "ready";
  return "pending";
}

const branch = git(["branch", "--show-current"]) ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? null;
const commit = git(["rev-parse", "--short", "HEAD"]) ?? process.env.GITHUB_SHA?.slice(0, 12) ?? null;
const nativeConfig = readJson(join(evidenceDir, "native-config.json"));
const runnerCapability = readJson(join(evidenceDir, "runner-capability.json"));
const nativeBuild = readJson(join(evidenceDir, "native-build.json"));
const nativeSmoke = readJson(join(evidenceDir, "native-smoke.json"));
const releaseArtifacts = readJson(join(evidenceDir, "release-artifacts.json"));
const platforms = enabledNativePlatforms();
const ids = taskIds(branch);
const reviewUrl = envOrDefault(
  "NATIVE_HANDOFF_DASHBOARD_URL",
  process.env.PROOF_REVIEW_URL ?? process.env.ARTIFACT_REVIEW_URL ?? "https://work.hustletogether.com/projects/layers#releases",
);
const androidApp = envOrDefault("NATIVE_HANDOFF_ANDROID_APP", "android/app/build/outputs/apk/debug/app-debug.apk");
const iosScheme = envOrDefault("NATIVE_HANDOFF_IOS_SCHEME", "App");
const iosDestination = envOrDefault("NATIVE_HANDOFF_IOS_DESTINATION", "platform=iOS Simulator,name=iPhone 16");
const candidateArtifactRoots = (process.env.NATIVE_HANDOFF_ARTIFACT_ROOTS ?? "android/app/build/outputs,ios/App/build,dist,release,out")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const candidateArtifacts = candidateArtifactRoots
  .flatMap(listFiles)
  .filter((file) => !file.path.endsWith(".map"))
  .sort((a, b) => a.path.localeCompare(b.path))
  .slice(0, 200);

const packets = [
  {
    id: "android-device-smoke",
    label: "Android device or emulator smoke",
    owner: "Android runner, physical Android device, or device cloud",
    state: packetState(nativeSmoke),
    runnerRequirement: "Android SDK, installed app, KVM emulator or attached real device, and Maestro/Appium/Firebase Test Lab equivalent.",
    command: `pnpm runner:doctor && pnpm test:native:config && NATIVE_BUILD_RUN=1 NATIVE_REQUIRED=1 ANDROID_BUILD_COMMAND="pnpm exec cap sync android && cd android && ./gradlew :app:assembleDebug" pnpm build:native && MAESTRO_RUN=1 NATIVE_REQUIRED=1 pnpm test:native:smoke && pnpm native:handoff && pnpm test:proof`,
    expectedArtifacts: [
      ".evidence/runner-capability.json",
      ".evidence/native-config.json",
      ".evidence/native-build.json",
      ".evidence/native-smoke.json",
      ".evidence/native-device-handoff.json",
      ".evidence/proof-packet.json",
      "test-results or device-cloud screenshot/video links",
    ],
    unblocks: ["auth.google-native", "mobile.safe-area", "native-device proof lanes"],
    dashboardTarget: reviewUrl,
  },
  {
    id: "firebase-test-lab-android",
    label: "Firebase Test Lab Android run",
    owner: "Google Cloud runner with Firebase Test Lab access",
    state: "pending",
    runnerRequirement: "Firebase project with billing enabled, gcloud CLI, APK/AAB build, selected device matrix.",
    command: `gcloud firebase test android run --type robo --app ${androidApp} --device model=oriole,version=34,locale=en,orientation=portrait --results-bucket "$FIREBASE_TEST_LAB_BUCKET"`,
    expectedArtifacts: [
      ".evidence/native-smoke.json",
      "Firebase Test Lab matrix URL",
      "device screenshots",
      "device video or Robo/action log",
    ],
    unblocks: ["Android real/virtual device evidence when mirrored into native-smoke.json"],
    dashboardTarget: reviewUrl,
  },
  {
    id: "maestro-cloud-native",
    label: "Maestro Cloud mobile run",
    owner: "Maestro Cloud runner",
    state: "pending",
    runnerRequirement: "Maestro Cloud plan, app file, and committed .maestro flows.",
    command: `maestro cloud --app-file ${androidApp} --flows .maestro`,
    expectedArtifacts: [
      ".evidence/native-smoke.json",
      "Maestro Cloud run URL",
      "cloud screenshots",
      "cloud video",
    ],
    unblocks: ["Android or iOS smoke evidence when the cloud run is mirrored back"],
    dashboardTarget: reviewUrl,
  },
  {
    id: "ios-simulator-or-testflight",
    label: "iOS Simulator or TestFlight proof",
    owner: "Alfonso Mac or another macOS runner",
    state: packetState(nativeBuild, nativeSmoke),
    runnerRequirement: "macOS, Xcode, Apple signing/provisioning as needed, and Simulator/TestFlight access.",
    command: `pnpm runner:doctor && pnpm test:native:config && NATIVE_BUILD_RUN=1 NATIVE_REQUIRED=1 IOS_BUILD_COMMAND="pnpm exec cap sync ios && xcodebuild -project ios/App/App.xcodeproj -scheme ${iosScheme} -configuration Debug -destination '${iosDestination}' build" pnpm build:native && MAESTRO_RUN=1 NATIVE_REQUIRED=1 pnpm test:native:smoke && pnpm native:handoff && pnpm test:proof`,
    expectedArtifacts: [
      ".evidence/runner-capability.json",
      ".evidence/native-build.json",
      ".evidence/native-smoke.json",
      ".evidence/native-device-handoff.json",
      "Simulator or TestFlight screenshot/video evidence",
    ],
    unblocks: ["auth.google-native", "mobile.safe-area", "iOS/TestFlight release evidence"],
    dashboardTarget: reviewUrl,
  },
  {
    id: "signed-release-packages",
    label: "Signed desktop/mobile release packages",
    owner: "Release runner with signing credentials",
    state: packetState(releaseArtifacts),
    runnerRequirement: "Signing certificates, notarization/store credentials, and install/open verification on the target platform.",
    command: "RELEASE_ARTIFACTS_REQUIRED=1 pnpm build:release && pnpm native:handoff && pnpm test:proof",
    expectedArtifacts: [
      ".evidence/release-artifacts.json",
      ".evidence/native-device-handoff.json",
      ".evidence/proof-packet.json",
      "signed APK/AAB, IPA, DMG, EXE/MSI, or ZIP artifacts with checksums",
    ],
    unblocks: ["release.artifacts", "production release approval"],
    dashboardTarget: reviewUrl,
  },
];

const pendingPackets = packets.filter((packet) => packet.state !== "ready");
const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: pendingPackets.length ? "pending" : "ready",
  required: true,
  summary: pendingPackets.length
    ? "External native/device runners still need to execute the app and mirror evidence back before release lanes can turn green."
    : "All native handoff packets have current runner evidence.",
  project: {
    taskIds: ids,
    branch,
    commit,
    dashboardTarget: reviewUrl,
    enabledNativePlatforms: platforms,
  },
  currentRunner: {
    platform: platform(),
    arch: arch(),
    release: release(),
    readiness: runnerCapability?.readiness ?? null,
    recommendations: Array.isArray(runnerCapability?.recommendations) ? runnerCapability.recommendations : [],
  },
  sourceEvidence: {
    nativeConfig: nativeConfig ? ".evidence/native-config.json" : null,
    runnerCapability: runnerCapability ? ".evidence/runner-capability.json" : null,
    nativeBuild: nativeBuild ? ".evidence/native-build.json" : null,
    nativeSmoke: nativeSmoke ? ".evidence/native-smoke.json" : null,
    releaseArtifacts: releaseArtifacts ? ".evidence/release-artifacts.json" : null,
  },
  packets,
  artifactContract: {
    requiredFields: ["taskIds", "branch", "commit", "platform", "device", "capturedAt", "checksum", "reviewUrl"],
    requiredMediaForUiNative: ["desktop light screenshot", "desktop dark screenshot", "mobile light screenshot", "mobile dark screenshot", "video or replay"],
    nativeSmokeMustRecord: ["installed app", "device or simulator identity", "flow command", "screenshot/video links", "pass/fail status"],
    releaseArtifactsMustRecord: ["signed/notarized/upload status", "artifact path", "bytes", "checksum", "install/open verification"],
  },
  candidateArtifacts,
  copyBack: {
    archiveCommand: `tar -czf native-evidence-${(branch ?? "local").replace(/[^A-Za-z0-9._-]+/g, "-")}.tgz .evidence android/app/build/outputs ios/App/build dist release out 2>/dev/null || true`,
    dashboardTarget: reviewUrl,
  },
  deviceCloudOptions: [
    {
      id: "firebase-test-lab",
      label: "Firebase Test Lab",
      bestFor: "Android Robo or instrumentation smoke with screenshots, logs, and matrix results.",
      docs: "https://firebase.google.com/docs/test-lab/android/command-line",
    },
    {
      id: "browserstack-app-automate",
      label: "BrowserStack App Automate",
      bestFor: "Real-device Appium coverage when a paid device-cloud account is available.",
      docs: "https://www.browserstack.com/docs/app-automate/appium/getting-started",
    },
    {
      id: "aws-device-farm",
      label: "AWS Device Farm",
      bestFor: "Android/iOS physical-device suites and manual remote access in AWS us-west-2.",
      docs: "https://docs.aws.amazon.com/devicefarm/latest/developerguide/getting-started.html",
    },
    {
      id: "maestro-cloud",
      label: "Maestro Cloud",
      bestFor: "Reusing .maestro flows across Android and iOS cloud devices.",
      docs: "https://docs.maestro.dev/maestro-cloud",
    },
  ],
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[native-handoff] wrote ${out}`);
if (pendingPackets.length) {
  console.log(`[native-handoff] ${pendingPackets.length} packet(s) still need external runner evidence.`);
}
