#!/usr/bin/env tsx
/**
 * Checks whether the current machine can act as a useful proof/build runner.
 *
 * This does not install anything. It records capabilities so dashboards,
 * Linear comments, and proof packets can distinguish "not attempted" from
 * "runner cannot support this proof".
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { arch, platform, release } from "node:os";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const out = join(cwd, ".evidence", "runner-capability.json");
const androidRequired = process.env.ANDROID_EMULATOR_REQUIRED === "1";
const nativeRequired = process.env.NATIVE_RUNNER_REQUIRED === "1";

function commandPath(command: string): string | null {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    cwd,
    encoding: "utf-8",
  });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function cpuVirtualizationFlags(): number {
  try {
    const cpuinfo = readFileSync("/proc/cpuinfo", "utf-8");
    return (cpuinfo.match(/\b(vmx|svm)\b/g) ?? []).length;
  } catch {
    return 0;
  }
}

function write(payload: Record<string, unknown>) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[runner-capability] wrote ${out}`);
}

const tools = {
  node: commandPath("node"),
  pnpm: commandPath("pnpm"),
  git: commandPath("git"),
  gh: commandPath("gh"),
  adb: commandPath("adb"),
  emulator: commandPath("emulator"),
  sdkmanager: commandPath("sdkmanager"),
  maestro: commandPath("maestro"),
  java: commandPath("java"),
  xcodebuild: commandPath("xcodebuild"),
};

const checks = {
  linux: platform() === "linux",
  macos: platform() === "darwin",
  kvmDevice: existsSync("/dev/kvm"),
  cpuVirtualizationFlagCount: cpuVirtualizationFlags(),
  androidSdkTools: Boolean(tools.adb && tools.emulator && tools.sdkmanager),
  maestro: Boolean(tools.maestro),
  xcode: Boolean(tools.xcodebuild),
};

const androidEmulatorReady =
  checks.linux &&
  checks.kvmDevice &&
  checks.cpuVirtualizationFlagCount > 0 &&
  checks.androidSdkTools &&
  checks.maestro;

const iosRunnerReady = checks.macos && checks.xcode;
const linuxWebRunnerReady = checks.linux && Boolean(tools.node && tools.pnpm && tools.git);

const payload = {
  runAt: new Date().toISOString(),
  pass: (!androidRequired || androidEmulatorReady) && (!nativeRequired || androidEmulatorReady || iosRunnerReady),
  platform: platform(),
  arch: arch(),
  release: release(),
  githubActions: {
    isActions: process.env.GITHUB_ACTIONS === "true",
    runnerName: process.env.RUNNER_NAME ?? null,
    runnerOs: process.env.RUNNER_OS ?? null,
    runnerArch: process.env.RUNNER_ARCH ?? null,
  },
  tools,
  checks,
  readiness: {
    linuxWebRunnerReady,
    androidEmulatorReady,
    iosRunnerReady,
  },
  recommendations: [
    !linuxWebRunnerReady ? "Install Node, pnpm, and git for Linux/web self-hosted proof." : null,
    checks.linux && !checks.kvmDevice ? "Expose /dev/kvm by running Android proof in a VM/host runner with KVM, not this container." : null,
    checks.cpuVirtualizationFlagCount === 0 ? "Enable CPU virtualization in BIOS/Proxmox for Android emulator proof." : null,
    !checks.androidSdkTools ? "Install Android command line tools: adb, emulator, and sdkmanager." : null,
    !checks.maestro ? "Install Maestro or use a device-cloud/Appium path for native UI proof." : null,
    !iosRunnerReady ? "Use a macOS self-hosted runner or device cloud for iOS Simulator/TestFlight proof." : null,
  ].filter(Boolean),
};

write(payload);
if (!payload.pass) process.exit(1);
