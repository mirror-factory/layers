#!/usr/bin/env tsx
/**
 * Records which native/device proof providers are ready to run.
 *
 * This is not native proof. It is a readiness scan for the runners that can
 * produce native proof later: local Android, local macOS/iOS, BrowserStack
 * Maestro, Firebase Test Lab, Maestro Cloud, and AWS Device Farm.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { dirname, join } from "node:path";

type Check = {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
};

type Provider = {
  id: string;
  label: string;
  kind: "local" | "device-cloud";
  state: "ready" | "blocked";
  checks: Check[];
  canProve: string[];
  nextAction: string;
  docs?: string[];
};

const cwd = process.cwd();
const out = join(cwd, ".evidence", "native-provider-readiness.json");
const required = process.env.NATIVE_PROVIDER_REQUIRED === "1";
const androidApp = process.env.NATIVE_PROVIDER_ANDROID_APP ?? "android/app/build/outputs/apk/debug/app-debug.apk";
const iosApp = process.env.NATIVE_PROVIDER_IOS_APP ?? "ios/App/build/Build/Products/Debug-iphonesimulator/App.app";

function executablePath(path: string | undefined, relative: string): string | null {
  if (!path) return null;
  const candidate = join(path, relative);
  return existsSync(candidate) ? candidate : null;
}

function commandPath(command: string, fallbackPaths: Array<string | null> = []): string | null {
  for (const fallback of fallbackPaths) {
    if (fallback) return fallback;
  }
  const result = spawnSync("sh", ["-c", `command -v ${command}`], { cwd, encoding: "utf-8" });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function fileExists(rel: string): boolean {
  try {
    return existsSync(join(cwd, rel)) && statSync(join(cwd, rel)).isFile();
  } catch {
    return false;
  }
}

function dirExists(rel: string): boolean {
  try {
    return existsSync(join(cwd, rel)) && statSync(join(cwd, rel)).isDirectory();
  } catch {
    return false;
  }
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cpuVirtualizationFlags(): number {
  try {
    const cpuinfo = readFileSync("/proc/cpuinfo", "utf-8");
    return (cpuinfo.match(/\b(vmx|svm)\b/g) ?? []).length;
  } catch {
    return 0;
  }
}

function check(id: string, label: string, ready: boolean, pass: string, fail: string): Check {
  return { id, label, ready, detail: ready ? pass : fail };
}

function provider(input: Omit<Provider, "state">): Provider {
  return {
    ...input,
    state: input.checks.every((item) => item.ready) ? "ready" : "blocked",
  };
}

const runnerCapability = readJson(join(cwd, ".evidence", "runner-capability.json"));
const readiness = (runnerCapability?.readiness ?? {}) as Record<string, unknown>;
const tools = {
  adb: commandPath("adb", [
    executablePath(process.env.ANDROID_HOME, "platform-tools/adb"),
    executablePath(process.env.ANDROID_SDK_ROOT, "platform-tools/adb"),
  ]),
  emulator: commandPath("emulator", [
    executablePath(process.env.ANDROID_HOME, "emulator/emulator"),
    executablePath(process.env.ANDROID_SDK_ROOT, "emulator/emulator"),
  ]),
  sdkmanager: commandPath("sdkmanager", [
    executablePath(process.env.ANDROID_HOME, "cmdline-tools/latest/bin/sdkmanager"),
    executablePath(process.env.ANDROID_SDK_ROOT, "cmdline-tools/latest/bin/sdkmanager"),
  ]),
  gcloud: commandPath("gcloud"),
  maestro: commandPath("maestro"),
  aws: commandPath("aws"),
  xcodebuild: commandPath("xcodebuild"),
  xcrun: commandPath("xcrun"),
};
const hasMaestroFlows = dirExists(".maestro") || fileExists("maestro.yaml");
const hasAndroidApp = fileExists(androidApp);
const hasIosApp = dirExists(iosApp) || fileExists(iosApp);
const kvmReady = existsSync("/dev/kvm") && cpuVirtualizationFlags() > 0;
const androidToolingReady = Boolean(tools.adb && tools.emulator && tools.sdkmanager && tools.maestro);
const localAndroidNextAction = androidToolingReady
  ? "Expose /dev/kvm to this runner, attach an Android device with ANDROID_SERIAL, or use a device-cloud provider; then run native smoke and copy back native-smoke.json."
  : "Install or expose adb, sdkmanager, Android emulator, and Maestro; then expose /dev/kvm or attach a device before running native smoke and copying back native-smoke.json.";

const providers: Provider[] = [
  provider({
    id: "local-android-maestro",
    label: "Local Android emulator or attached device",
    kind: "local",
    canProve: ["Android runtime smoke", "Android screenshots", "Android video when recorder is configured"],
    nextAction: localAndroidNextAction,
    checks: [
      check("android-app", "Android app artifact", hasAndroidApp, `${androidApp} exists.`, `${androidApp} is missing.`),
      check("adb", "ADB available", Boolean(tools.adb), "adb is available.", "adb is not on PATH."),
      check("sdkmanager", "Android SDK manager available", Boolean(tools.sdkmanager), "sdkmanager is available.", "sdkmanager is not on PATH."),
      check("emulator", "Android emulator available", Boolean(tools.emulator), "Android emulator is available.", "Android emulator is not on PATH."),
      check("emulator-or-device", "Emulator host or attached device path", kvmReady || envPresent("ANDROID_SERIAL"), "KVM/device path is present.", "No /dev/kvm and ANDROID_SERIAL is not set."),
      check("maestro", "Maestro available", Boolean(tools.maestro), "Maestro is available.", "Maestro is not on PATH."),
    ],
  }),
  provider({
    id: "local-ios-xcode",
    label: "Local macOS/iOS simulator or TestFlight path",
    kind: "local",
    canProve: ["iOS simulator smoke", "macOS/iOS screenshots", "macOS/iOS video when recorder is configured"],
    nextAction: "Run the scan on a Mac with Xcode, an iOS build or simulator app, and Maestro or xcrun recording available.",
    checks: [
      check("macos", "macOS runner", platform() === "darwin", "This runner is macOS.", "This runner is not macOS."),
      check("xcode", "Xcode command line tools", Boolean(tools.xcodebuild && tools.xcrun), "xcodebuild and xcrun are available.", "xcodebuild or xcrun is missing."),
      check("ios-app", "iOS app artifact", hasIosApp || envPresent("NATIVE_PROVIDER_IOS_APP"), "iOS app path is configured.", "No iOS app artifact path is present."),
    ],
  }),
  provider({
    id: "browserstack-maestro",
    label: "BrowserStack App Automate Maestro",
    kind: "device-cloud",
    canProve: ["Real Android device smoke", "Real iOS device smoke", "Device screenshots", "Device video", "Device-cloud run URL"],
    nextAction: "Set BrowserStack credentials, provide an app artifact and Maestro flows, then run the BrowserStack Maestro command from native-device-handoff.json.",
    docs: [
      "https://www.browserstack.com/docs/app-automate/maestro",
      "https://www.browserstack.com/docs/app-automate/api-reference/maestro/apps",
      "https://www.browserstack.com/docs/app-automate/api-reference/maestro/tests",
    ],
    checks: [
      check("username", "Username present", envPresent("BROWSERSTACK_USERNAME"), "BROWSERSTACK_USERNAME is set.", "BROWSERSTACK_USERNAME is not set."),
      check("access-key", "Access key present", envPresent("BROWSERSTACK_ACCESS_KEY"), "BROWSERSTACK_ACCESS_KEY is set.", "BROWSERSTACK_ACCESS_KEY is not set."),
      check("app", "App artifact", hasAndroidApp || hasIosApp, "An app artifact is available.", "No Android or iOS app artifact is available."),
      check("maestro-flows", "Maestro flows", hasMaestroFlows, "Maestro flows are present.", ".maestro or maestro.yaml is missing."),
    ],
  }),
  provider({
    id: "firebase-test-lab",
    label: "Firebase Test Lab Android",
    kind: "device-cloud",
    canProve: ["Android real or virtual device smoke", "Firebase matrix URL", "Android screenshots/video/logs"],
    nextAction: "Set a Firebase/GCP project with billing, install gcloud, provide the Android app artifact, then run gcloud firebase test android run.",
    docs: ["https://firebase.google.com/docs/test-lab/android/command-line"],
    checks: [
      check("gcloud", "gcloud available", Boolean(tools.gcloud), "gcloud is available.", "gcloud is not on PATH."),
      check("project", "Firebase/GCP project", envPresent("FIREBASE_PROJECT") || envPresent("GOOGLE_CLOUD_PROJECT"), "A Firebase/GCP project env var is set.", "FIREBASE_PROJECT or GOOGLE_CLOUD_PROJECT is not set."),
      check("android-app", "Android app artifact", hasAndroidApp, `${androidApp} exists.`, `${androidApp} is missing.`),
    ],
  }),
  provider({
    id: "maestro-cloud",
    label: "Maestro Cloud",
    kind: "device-cloud",
    canProve: ["Hosted Maestro smoke", "Cloud screenshots", "Cloud video", "Cloud run URL"],
    nextAction: "Set Maestro Cloud credentials, provide app artifacts and Maestro flows, then run the Maestro Cloud command from native-device-handoff.json.",
    docs: ["https://docs.maestro.dev/cloud/run-maestro-tests-in-the-cloud"],
    checks: [
      check("maestro", "Maestro CLI available", Boolean(tools.maestro), "Maestro CLI is available.", "Maestro CLI is not on PATH."),
      check("token", "Maestro Cloud credentials", envPresent("MAESTRO_CLOUD_API_KEY") || envPresent("MAESTRO_CLOUD_TOKEN"), "Maestro Cloud credentials are set.", "MAESTRO_CLOUD_API_KEY or MAESTRO_CLOUD_TOKEN is not set."),
      check("app", "App artifact", hasAndroidApp || hasIosApp, "An app artifact is available.", "No Android or iOS app artifact is available."),
      check("flows", "Maestro flows", hasMaestroFlows, "Maestro flows are present.", ".maestro or maestro.yaml is missing."),
    ],
  }),
  provider({
    id: "aws-device-farm",
    label: "AWS Device Farm",
    kind: "device-cloud",
    canProve: ["Real Android/iOS device smoke", "AWS Device Farm run URL", "Device logs", "Device screenshots/video"],
    nextAction: "Set AWS credentials and region, provide an app artifact, then create/upload/schedule an AWS Device Farm run.",
    docs: ["https://docs.aws.amazon.com/devicefarm/latest/developerguide/getting-started.html"],
    checks: [
      check("aws-cli", "AWS CLI available", Boolean(tools.aws), "aws CLI is available.", "aws CLI is not on PATH."),
      check("credentials", "AWS credentials", envPresent("AWS_PROFILE") || (envPresent("AWS_ACCESS_KEY_ID") && envPresent("AWS_SECRET_ACCESS_KEY")), "AWS credentials are configured.", "AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY are not set."),
      check("region", "AWS region", envPresent("AWS_REGION") || envPresent("AWS_DEFAULT_REGION"), "AWS region is set.", "AWS_REGION or AWS_DEFAULT_REGION is not set."),
      check("app", "App artifact", hasAndroidApp || hasIosApp, "An app artifact is available.", "No Android or iOS app artifact is available."),
    ],
  }),
];

const readyProviders = providers.filter((item) => item.state === "ready");
const recommendedProvider =
  providers.find((item) => item.id === "browserstack-maestro" && item.state === "ready") ??
  providers.find((item) => item.id === "firebase-test-lab" && item.state === "ready") ??
  providers.find((item) => item.state === "ready") ??
  null;

const payload = {
  runAt: new Date().toISOString(),
  pass: !required || readyProviders.length > 0,
  required,
  status: readyProviders.length > 0 ? "ready" : "blocked",
  summary: readyProviders.length > 0
    ? `${readyProviders.length} native proof provider path(s) are ready to execute.`
    : "No native proof provider path is ready to execute on this machine yet.",
  currentRunner: {
    platform: platform(),
    arch: arch(),
    release: release(),
    runnerCapability: existsSync(join(cwd, ".evidence", "runner-capability.json")) ? ".evidence/runner-capability.json" : null,
    readiness,
  },
  appArtifacts: {
    androidApp,
    androidAppPresent: hasAndroidApp,
    iosApp,
    iosAppPresent: hasIosApp,
    maestroFlowsPresent: hasMaestroFlows,
  },
  tools,
  providers,
  readyProviderIds: readyProviders.map((item) => item.id),
  recommendedProviderId: recommendedProvider?.id ?? null,
  nextActions: providers
    .filter((item) => item.state !== "ready")
    .map((item) => ({ providerId: item.id, label: item.label, nextAction: item.nextAction })),
  proofBoundary: "This artifact only proves provider readiness. Native/device proof still requires native-smoke.json with device identity, screenshots, video, run URL, and a passing copy-back command.",
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[native-provider-readiness] wrote ${out}`);
if (!payload.pass) process.exit(1);
