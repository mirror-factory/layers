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

function stringField(payload: JsonObject | null, key: string): string {
  const value = payload?.[key];
  return typeof value === "string" ? value.toLowerCase() : "";
}

function listField(payload: JsonObject | null, key: string): unknown[] {
  const value = payload?.[key];
  return Array.isArray(value) ? value : [];
}

function nativeSmokeReadyFor(targetPlatform: string): "ready" | "pending" | "blocked" {
  if (nativeSmoke?.pass === false && nativeSmoke.required === true) return "blocked";
  if (nativeSmoke?.pass !== true || nativeSmoke.skipped === true) return "pending";
  const target = targetPlatform.toLowerCase();
  const platformText = [
    stringField(nativeSmoke, "platform"),
    ...listField(nativeSmoke, "platforms").map((item) => String(item).toLowerCase()),
  ].join(" ");
  const hasTargetPlatform = platformText.includes(target);
  const hasDevice = Boolean(nativeSmoke.device || nativeSmoke.deviceName || nativeSmoke.simulator);
  const hasRunner = Boolean(nativeSmoke.runner || nativeSmoke.runnerName || nativeSmoke.runUrl);
  const hasFlow = Boolean(nativeSmoke.flowCommand || nativeSmoke.command);
  const hasMedia = listField(nativeSmoke, "screenshots").length > 0 && listField(nativeSmoke, "videos").length > 0;
  return hasTargetPlatform && hasDevice && hasRunner && hasFlow && hasMedia ? "ready" : "pending";
}

function signedReleaseReady(): "ready" | "pending" | "blocked" {
  if (releaseArtifacts?.pass === false && releaseArtifacts.required === true) return "blocked";
  if (releaseArtifacts?.pass !== true) return "pending";
  const statusText = [
    stringField(releaseArtifacts, "status"),
    stringField(releaseArtifacts, "releaseStatus"),
    stringField(releaseArtifacts, "uploadStatus"),
  ].join(" ");
  const explicitReady = releaseArtifacts.signed === true
    || releaseArtifacts.notarized === true
    || releaseArtifacts.releaseReady === true
    || releaseArtifacts.releaseReviewable === true
    || releaseArtifacts.storeUpload === true
    || /\b(signed|notarized|uploaded|reviewable|release-ready|green)\b/.test(statusText);
  return explicitReady ? "ready" : "pending";
}

const branch = git(["branch", "--show-current"]) ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? null;
const commit = git(["rev-parse", "--short", "HEAD"]) ?? process.env.GITHUB_SHA?.slice(0, 12) ?? null;
const nativeConfig = readJson(join(evidenceDir, "native-config.json"));
const runnerCapability = readJson(join(evidenceDir, "runner-capability.json"));
const nativeBuild = readJson(join(evidenceDir, "native-build.json"));
const nativeSmoke = readJson(join(evidenceDir, "native-smoke.json"));
const releaseArtifacts = readJson(join(evidenceDir, "release-artifacts.json"));
const providerReadiness = readJson(join(evidenceDir, "native-provider-readiness.json"));
const nativeEvidenceIndex = readJson(join(evidenceDir, "native-evidence-index.json"));
const androidEmulatorAttempt = readJson(join(evidenceDir, "android-emulator-proof", "attempt.json"));
const platforms = enabledNativePlatforms();
const ids = taskIds(branch);
const reviewUrl = envOrDefault(
  "NATIVE_HANDOFF_DASHBOARD_URL",
  process.env.PROOF_REVIEW_URL ?? process.env.ARTIFACT_REVIEW_URL ?? "https://work.hustletogether.com/projects/layers#releases",
);
const androidApp = envOrDefault("NATIVE_HANDOFF_ANDROID_APP", "android/app/build/outputs/apk/debug/app-debug.apk");
const iosScheme = envOrDefault("NATIVE_HANDOFF_IOS_SCHEME", "App");
const iosDestination = envOrDefault("NATIVE_HANDOFF_IOS_DESTINATION", "platform=iOS Simulator,name=iPhone 16");
const maestroSuiteZip = envOrDefault("NATIVE_HANDOFF_MAESTRO_SUITE_ZIP", "maestro-flows.zip");
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
    state: nativeSmokeReadyFor("android"),
    runnerRequirement: "Android SDK, installed app, KVM emulator or attached real device, and Maestro/Appium/Firebase Test Lab equivalent.",
    command: `pnpm runner:doctor && pnpm native:providers && pnpm test:native:config && NATIVE_BUILD_RUN=1 NATIVE_REQUIRED=1 ANDROID_BUILD_COMMAND="pnpm exec cap sync android && cd android && ./gradlew :app:assembleDebug" pnpm build:native && MAESTRO_RUN=1 NATIVE_REQUIRED=1 pnpm test:native:smoke && pnpm native:handoff && pnpm test:proof`,
    expectedArtifacts: [
      ".evidence/runner-capability.json",
      ".evidence/native-provider-readiness.json",
      ".evidence/native-config.json",
      ".evidence/native-build.json",
      ".evidence/native-smoke.json",
      ".evidence/native-device-handoff.json",
      ".evidence/proof-packet.json",
      "test-results or device-cloud screenshot/video links",
    ],
    copyBackCommand: `NATIVE_SMOKE_PASS=1 NATIVE_SMOKE_PLATFORM=android NATIVE_SMOKE_DEVICE="<device model>" NATIVE_SMOKE_RUNNER="<runner name>" NATIVE_SMOKE_FLOW="<flow command>" NATIVE_SMOKE_SCREENSHOTS="<screenshot paths or URLs>" NATIVE_SMOKE_VIDEOS="<video paths or URLs>" NATIVE_SMOKE_RUN_URL="<runner URL>" pnpm native:record-smoke && pnpm native:handoff && pnpm test:proof`,
    unblocks: ["auth.google-native", "mobile.safe-area", "native-device proof lanes"],
    dashboardTarget: reviewUrl,
  },
  {
    id: "browserstack-maestro-real-device",
    label: "BrowserStack Maestro real-device proof",
    owner: "BrowserStack App Automate account",
    state: "pending",
    runnerRequirement: "BrowserStack username/access key, uploaded APK or IPA, zipped Maestro flow suite, and selected real Android/iOS devices.",
    command: `zip -r ${maestroSuiteZip} .maestro && curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" -X POST "https://api-cloud.browserstack.com/app-automate/maestro/v2/app" -F "file=@${androidApp}" -F "custom_id=layers-native" && curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" -X POST "https://api-cloud.browserstack.com/app-automate/maestro/v2/test-suite" -F "file=@${maestroSuiteZip}" -F "custom_id=layers-maestro" && curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" -X POST "https://api-cloud.browserstack.com/app-automate/maestro/v2/android/build" -H "Content-Type: application/json" -d '{"app":"<bs://app_url>","testSuite":"<bs://test_suite_url>","project":"Layers Native Proof","devices":["Google Pixel 7-13.0"]}'`,
    expectedArtifacts: [
      ".evidence/native-smoke.json",
      "BrowserStack build URL",
      "real-device screenshots",
      "real-device video",
      "device logs or Maestro session logs",
    ],
    copyBackCommand: `NATIVE_SMOKE_PASS=1 NATIVE_SMOKE_PLATFORM="<ios or android>" NATIVE_SMOKE_DEVICE="<BrowserStack device and OS>" NATIVE_SMOKE_RUNNER="BrowserStack Maestro" NATIVE_SMOKE_FLOW="BrowserStack App Automate Maestro build" NATIVE_SMOKE_SCREENSHOTS="<BrowserStack screenshot paths or URLs>" NATIVE_SMOKE_VIDEOS="<BrowserStack video paths or URLs>" NATIVE_SMOKE_RUN_URL="<BrowserStack build/session URL>" pnpm native:record-smoke && pnpm native:handoff && pnpm test:proof`,
    unblocks: ["Android real-device evidence", "iOS real-device evidence", "native-device proof lanes"],
    dashboardTarget: reviewUrl,
    docs: [
      "https://www.browserstack.com/docs/app-automate/maestro",
      "https://www.browserstack.com/docs/app-automate/api-reference/maestro/apps",
      "https://www.browserstack.com/docs/app-automate/api-reference/maestro/tests",
    ],
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
    copyBackCommand: `NATIVE_SMOKE_PASS=1 NATIVE_SMOKE_PLATFORM=android NATIVE_SMOKE_DEVICE="Firebase Test Lab device matrix" NATIVE_SMOKE_RUNNER="Firebase Test Lab" NATIVE_SMOKE_FLOW="gcloud firebase test android run" NATIVE_SMOKE_SCREENSHOTS="<downloaded screenshot paths or URLs>" NATIVE_SMOKE_VIDEOS="<downloaded video paths or URLs>" NATIVE_SMOKE_RUN_URL="<matrix URL>" pnpm native:record-smoke && pnpm native:handoff && pnpm test:proof`,
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
    copyBackCommand: `NATIVE_SMOKE_PASS=1 NATIVE_SMOKE_PLATFORM=android NATIVE_SMOKE_DEVICE="Maestro Cloud device" NATIVE_SMOKE_RUNNER="Maestro Cloud" NATIVE_SMOKE_FLOW="maestro cloud --app-file ${androidApp} --flows .maestro" NATIVE_SMOKE_SCREENSHOTS="<cloud screenshot paths or URLs>" NATIVE_SMOKE_VIDEOS="<cloud video paths or URLs>" NATIVE_SMOKE_RUN_URL="<Maestro Cloud run URL>" pnpm native:record-smoke && pnpm native:handoff && pnpm test:proof`,
    unblocks: ["Android or iOS smoke evidence when the cloud run is mirrored back"],
    dashboardTarget: reviewUrl,
  },
  {
    id: "ios-simulator-or-testflight",
    label: "iOS Simulator or TestFlight proof",
    owner: "Alfonso Mac or another macOS runner",
    state: nativeSmokeReadyFor("ios"),
    runnerRequirement: "macOS, Xcode, Apple signing/provisioning as needed, and Simulator/TestFlight access.",
    command: `pnpm runner:doctor && pnpm native:providers && pnpm test:native:config && NATIVE_BUILD_RUN=1 NATIVE_REQUIRED=1 IOS_BUILD_COMMAND="pnpm exec cap sync ios && xcodebuild -project ios/App/App.xcodeproj -scheme ${iosScheme} -configuration Debug -destination '${iosDestination}' build" pnpm build:native && MAESTRO_RUN=1 NATIVE_REQUIRED=1 pnpm test:native:smoke && pnpm native:handoff && pnpm test:proof`,
    expectedArtifacts: [
      ".evidence/runner-capability.json",
      ".evidence/native-provider-readiness.json",
      ".evidence/native-build.json",
      ".evidence/native-smoke.json",
      ".evidence/native-device-handoff.json",
      "Simulator or TestFlight screenshot/video evidence",
    ],
    copyBackCommand: `NATIVE_SMOKE_PASS=1 NATIVE_SMOKE_PLATFORM=ios NATIVE_SMOKE_DEVICE="<simulator or TestFlight device>" NATIVE_SMOKE_RUNNER="macOS/Xcode" NATIVE_SMOKE_FLOW="<xcodebuild or Maestro command>" NATIVE_SMOKE_SCREENSHOTS="<screenshot paths or URLs>" NATIVE_SMOKE_VIDEOS="<video paths or URLs>" NATIVE_SMOKE_RUN_URL="<review URL>" pnpm native:record-smoke && pnpm native:handoff && pnpm test:proof`,
    unblocks: ["auth.google-native", "mobile.safe-area", "iOS/TestFlight release evidence"],
    dashboardTarget: reviewUrl,
  },
  {
    id: "signed-release-packages",
    label: "Signed or reviewable release packages",
    owner: "Release runner with signing credentials",
    state: signedReleaseReady(),
    runnerRequirement: "Signing certificates, notarization/store credentials, or an explicitly reviewable internal artifact plus install/open verification on the target platform.",
    command: "RELEASE_ARTIFACTS_REQUIRED=1 pnpm build:release && pnpm native:handoff && pnpm test:proof",
    expectedArtifacts: [
      ".evidence/release-artifacts.json",
      ".evidence/native-device-handoff.json",
      ".evidence/proof-packet.json",
      "signed APK/AAB, IPA, DMG, EXE/MSI, or ZIP artifacts with checksums",
    ],
    copyBackCommand: `RELEASE_ARTIFACTS_REQUIRED=1 RELEASE_REVIEWABLE=1 RELEASE_REVIEW_URL="<dashboard artifact URL>" RELEASE_STATUS=reviewable-internal-artifact RELEASE_UPLOAD_STATUS="<store, notarization, release URL, or review URL>" pnpm build:release && pnpm native:handoff && pnpm test:proof`,
    unblocks: ["release.artifacts", "production release approval"],
    dashboardTarget: reviewUrl,
  },
];

const pendingPackets = packets.filter((packet) => packet.state !== "ready");
const readyProviderIds = listField(providerReadiness, "readyProviderIds").map((item) => String(item));
const providerReady = (id: string): boolean => readyProviderIds.includes(id);
const runbookPaths = [
  {
    id: "mac-ios-proof",
    label: "Mac iOS proof",
    state: nativeSmokeReadyFor("ios"),
    bestWhen: "Use this when a Mac with Xcode, Simulator or TestFlight access, and signing context is available.",
    proves: ["iOS runtime behavior", "native auth callback surface", "safe-area behavior", "iOS screenshot/video evidence"],
    command: packets.find((packet) => packet.id === "ios-simulator-or-testflight")?.command,
    copyBackCommand: packets.find((packet) => packet.id === "ios-simulator-or-testflight")?.copyBackCommand,
    expectedOutputs: [".evidence/native-smoke.json", "iOS screenshot", "iOS video or simulator recording", "runner URL or logs"],
    unblocks: ["auth.google-native", "mobile.safe-area", "iOS release evidence"],
  },
  {
    id: "android-device-proof",
    label: "Android device proof",
    state: nativeSmokeReadyFor("android"),
    bestWhen: "Use this when an Android phone is attached, KVM emulator access exists, or a cloud Android runner is available.",
    proves: ["Android runtime behavior", "safe-area behavior", "Android screenshot/video evidence"],
    command: packets.find((packet) => packet.id === "android-device-smoke")?.command,
    copyBackCommand: packets.find((packet) => packet.id === "android-device-smoke")?.copyBackCommand,
    expectedOutputs: [".evidence/native-smoke.json", "Android screenshot", "Android video or replay", "runner URL or logs"],
    unblocks: ["mobile.safe-area", "Android runtime proof", "native-device proof lanes"],
  },
  {
    id: "browserstack-real-device",
    label: "BrowserStack real-device proof",
    state: providerReady("browserstack-maestro") ? "ready" : "pending",
    bestWhen: "Use this when BrowserStack credentials are available and one provider should cover real Android and iOS device evidence.",
    proves: ["real Android device evidence", "real iOS device evidence", "device-cloud run URL", "screenshots and video"],
    command: packets.find((packet) => packet.id === "browserstack-maestro-real-device")?.command,
    copyBackCommand: packets.find((packet) => packet.id === "browserstack-maestro-real-device")?.copyBackCommand,
    expectedOutputs: [".evidence/native-smoke.json", "BrowserStack build/session URL", "real-device screenshots", "real-device video"],
    unblocks: ["Android runtime proof", "iOS runtime proof", "native-device proof lanes"],
  },
  {
    id: "signed-release-proof",
    label: "Signed release artifact proof",
    state: signedReleaseReady(),
    bestWhen: "Use this after native proof is green and release credentials are available for signed, notarized, uploaded, or explicitly reviewable artifacts.",
    proves: ["signed or reviewable build artifact", "artifact checksum", "release upload or notarization status", "install/open verification"],
    command: packets.find((packet) => packet.id === "signed-release-packages")?.command,
    copyBackCommand: packets.find((packet) => packet.id === "signed-release-packages")?.copyBackCommand,
    expectedOutputs: [".evidence/release-artifacts.json", "signed or reviewable package", "checksum", "store, notarization, or release URL"],
    unblocks: ["release.artifacts", "production release approval"],
  },
];
const recommendedRunbookPath =
  runbookPaths.find((item) => item.id === "browserstack-real-device" && item.state === "ready")
  ?? runbookPaths.find((item) => item.id === "mac-ios-proof" && item.state !== "ready")
  ?? runbookPaths.find((item) => item.state !== "ready")
  ?? runbookPaths[0];
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
    providerReadiness: providerReadiness ? ".evidence/native-provider-readiness.json" : null,
    nativeEvidenceIndex: nativeEvidenceIndex ? ".evidence/native-evidence-index.json" : null,
    androidEmulatorAttempt: androidEmulatorAttempt ? ".evidence/android-emulator-proof/attempt.json" : null,
    nativeBuild: nativeBuild ? ".evidence/native-build.json" : null,
    nativeSmoke: nativeSmoke ? ".evidence/native-smoke.json" : null,
    releaseArtifacts: releaseArtifacts ? ".evidence/release-artifacts.json" : null,
  },
  blockedAttemptEvidence: androidEmulatorAttempt ? {
    path: ".evidence/android-emulator-proof/attempt.json",
    status: androidEmulatorAttempt.status ?? androidEmulatorAttempt.state ?? "blocked",
    summary: androidEmulatorAttempt.summary ?? androidEmulatorAttempt.reason ?? "CT100 Android emulator attempt did not produce device proof.",
    proofBoundary: "This is blocked attempt evidence. It explains why CT100 did not produce native/device proof and must not be counted as a passing native lane."
  } : null,
  packets,
  runbook: {
    title: "Native and release proof runbook",
    summary: "Use these paths to close native/device and signed release blockers without paid GitHub-hosted Actions.",
    recommendedPathId: recommendedRunbookPath?.id ?? null,
    dashboardTarget: reviewUrl,
    paths: runbookPaths,
    copyBackRequirements: [
      "Record device or simulator identity.",
      "Attach at least one screenshot and one video or replay for native runtime proof.",
      "Record the runner name, flow command, and run URL, logs, or artifact bundle.",
      "Regenerate native-device-handoff.json and proof-packet.json after native:record-smoke.",
      "Mirror the updated .evidence files and media back to the dashboard artifact root."
    ],
    releaseRequirements: [
      "Record signed, notarized, uploaded, release-ready, or explicitly reviewable status.",
      "Attach release artifact path, byte size, checksum, and install/open verification.",
      "Keep staging/main promotion held until native and release proof artifacts are green."
    ],
    proofBoundary: "This runbook is coordination evidence only. Native and release lanes turn green only after native-smoke.json, release-artifacts.json, media, and proof-packet.json are copied back with passing evidence."
  },
  artifactContract: {
    requiredFields: ["taskIds", "branch", "commit", "platform", "device", "capturedAt", "checksum", "reviewUrl"],
    requiredMediaForUiNative: ["desktop light screenshot", "desktop dark screenshot", "mobile light screenshot", "mobile dark screenshot", "video or replay"],
    nativeSmokeMustRecord: ["installed app", "device or simulator identity", "flow command", "screenshot/video links", "pass/fail status"],
    releaseArtifactsMustRecord: ["signed/notarized/upload status", "artifact path", "bytes", "checksum", "install/open verification"],
  },
  candidateArtifacts,
  copyBack: {
    recordCommand: `NATIVE_SMOKE_PASS=1 NATIVE_SMOKE_PLATFORM=<platform> NATIVE_SMOKE_DEVICE=<device> NATIVE_SMOKE_RUNNER=<runner> NATIVE_SMOKE_FLOW=<flow> NATIVE_SMOKE_SCREENSHOTS=<paths-or-urls> NATIVE_SMOKE_VIDEOS=<paths-or-urls> pnpm native:record-smoke`,
    releaseRecordCommand: `RELEASE_ARTIFACTS_REQUIRED=1 RELEASE_SIGNED=1 RELEASE_NOTARIZED=1 RELEASE_STORE_UPLOAD=1 RELEASE_READY=1 RELEASE_STATUS=release-ready RELEASE_UPLOAD_STATUS=<store-or-release-url> pnpm build:release`,
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
      label: "BrowserStack App Automate Maestro",
      bestFor: "Real iOS and Android device proof using Maestro flows when a paid device-cloud account is available.",
      docs: "https://www.browserstack.com/docs/app-automate/maestro",
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
