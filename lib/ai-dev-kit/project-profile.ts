import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ProjectProfile {
  schemaVersion: number;
  kitProfile: string;
  project: {
    id: string;
    name: string;
    repo: string;
    primaryDashboardUrl?: string;
    linearProjectSlug?: string;
  };
  sourceOfTruth: Record<string, string>;
  branchModel: {
    integration: string;
    releaseCandidate: string;
    production: string;
    agentBranchPrefix?: string;
    requiredPrTarget: string;
  };
  platforms: Record<string, {
    enabled: boolean;
    reviewChannel?: string;
    requiredTiers?: number[];
    nativeHarness?: string;
  }>;
  services: Record<string, {
    default?: boolean;
    enabled: boolean;
    requiredEnv?: string[];
  }>;
  tools: Record<string, {
    required: boolean;
    tier?: number;
    reason?: string;
    requiredBeforeNativeAutomerge?: boolean;
  }>;
  designSystem: {
    mode: "no-inference" | "guided" | "freeform";
    tokensPath: string;
    systemPath: string;
    componentsRegistryPath: string;
    referenceSurfaces?: string[];
    aiRules?: string[];
  };
  proofPolicy: Record<string, unknown>;
  nativePolicy?: {
    mobileAppId?: string;
    deepLinkScheme?: string;
    oauthCallbackPath?: string;
    electronAppId?: string;
    artifactRoots?: string[];
  };
  reviewPolicy: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  symphony?: Record<string, unknown>;
}

export interface HarnessCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  path?: string;
}

export interface ProjectHarnessReport {
  generatedAt: string;
  profilePath: string;
  project: ProjectProfile["project"] | null;
  branchModel: ProjectProfile["branchModel"] | null;
  pass: boolean;
  checks: HarnessCheck[];
  enabledPlatforms: string[];
  enabledServices: string[];
  requiredTools: string[];
}

const PROFILE_PATH = ".ai-dev-kit/project-profile.json";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function hasPackage(pkg: Record<string, unknown>, name: string): boolean {
  const deps = {
    ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
    ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
  };
  return name in deps;
}

function hasScript(pkg: Record<string, unknown>, name: string): boolean {
  const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {};
  return name in scripts;
}

function add(
  checks: HarnessCheck[],
  id: string,
  label: string,
  ok: boolean,
  passDetail: string,
  failDetail: string,
  path?: string,
  warn = false,
) {
  checks.push({
    id,
    label,
    status: ok ? "pass" : warn ? "warn" : "fail",
    detail: ok ? passDetail : failDetail,
    path,
  });
}

function hasAnyFile(cwd: string, paths: string[]): boolean {
  return paths.some(path => existsSync(join(cwd, path)));
}

function hasFilesIn(cwd: string, path: string): boolean {
  const full = join(cwd, path);
  if (!existsSync(full)) return false;
  return readdirSync(full).length > 0;
}

function newestFileMtime(cwd: string, path: string): string | null {
  const full = join(cwd, path);
  if (!existsSync(full)) return null;
  let newest = 0;
  function walk(current: string) {
    const stat = statSync(current);
    if (stat.isFile()) {
      newest = Math.max(newest, stat.mtimeMs);
      return;
    }
    if (!stat.isDirectory()) return;
    for (const entry of readdirSync(current)) walk(join(current, entry));
  }
  walk(full);
  return newest > 0 ? new Date(newest).toISOString() : null;
}

export function projectProfilePath(cwd = process.cwd()): string {
  return join(cwd, PROFILE_PATH);
}

export function loadProjectProfile(cwd = process.cwd()): ProjectProfile {
  const path = projectProfilePath(cwd);
  return readJson(path) as ProjectProfile;
}

export function evaluateProjectHarness(cwd = process.cwd()): ProjectHarnessReport {
  const checks: HarnessCheck[] = [];
  const profilePath = projectProfilePath(cwd);

  if (!existsSync(profilePath)) {
    return {
      generatedAt: new Date().toISOString(),
      profilePath: PROFILE_PATH,
      project: null,
      branchModel: null,
      pass: false,
      checks: [{
        id: "project-profile.present",
        label: "Project profile",
        status: "fail",
        detail: "Missing .ai-dev-kit/project-profile.json.",
        path: PROFILE_PATH,
      }],
      enabledPlatforms: [],
      enabledServices: [],
      requiredTools: [],
    };
  }

  let profile: ProjectProfile;
  try {
    profile = loadProjectProfile(cwd);
    add(checks, "project-profile.valid-json", "Project profile JSON", true, "Profile parsed.", "Profile is malformed JSON.", PROFILE_PATH);
  } catch (err) {
    return {
      generatedAt: new Date().toISOString(),
      profilePath: PROFILE_PATH,
      project: null,
      branchModel: null,
      pass: false,
      checks: [{
        id: "project-profile.valid-json",
        label: "Project profile JSON",
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
        path: PROFILE_PATH,
      }],
      enabledPlatforms: [],
      enabledServices: [],
      requiredTools: [],
    };
  }

  const pkgPath = join(cwd, "package.json");
  const pkg = existsSync(pkgPath) ? readJson(pkgPath) as Record<string, unknown> : {};
  const requiredTools = Object.entries(profile.tools)
    .filter(([, tool]) => tool.required)
    .map(([name]) => name);
  const enabledPlatforms = Object.entries(profile.platforms)
    .filter(([, platform]) => platform.enabled)
    .map(([name]) => name);
  const enabledServices = Object.entries(profile.services)
    .filter(([, service]) => service.enabled)
    .map(([name]) => name);

  add(checks, "project.id", "Project identity", Boolean(profile.project?.id && profile.project?.repo), `${profile.project.name} (${profile.project.repo})`, "Project id/repo missing.", PROFILE_PATH);
  add(checks, "branch.integration", "Integration branch", profile.branchModel.integration === "development", "Agents target development.", `Expected integration branch development, got ${profile.branchModel.integration}.`, PROFILE_PATH);
  add(checks, "branch.production", "Production branch", profile.branchModel.production === "main", "Production is main.", `Expected production branch main, got ${profile.branchModel.production}.`, PROFILE_PATH);

  add(checks, "tool.typescript", "TypeScript", hasScript(pkg, "typecheck"), "typecheck script present.", "Missing package.json script: typecheck.", "package.json");
  add(checks, "tool.vitest", "Vitest", hasPackage(pkg, "vitest") && hasScript(pkg, "test:fast"), "Vitest and test:fast present.", "Missing vitest dependency or test:fast script.", "package.json");
  add(checks, "tool.playwright", "Playwright", hasPackage(pkg, "@playwright/test") && existsSync(join(cwd, "playwright.config.ts")) && hasFilesIn(cwd, "tests/e2e"), "Playwright config and e2e tests present.", "Missing Playwright dependency, config, or tests/e2e.", "playwright.config.ts");
  add(checks, "tool.expect", "Expect", hasPackage(pkg, "expect-cli") && hasFilesIn(cwd, "tests/expect"), "Expect dependency and flows present.", "Missing expect-cli or tests/expect flows.", "tests/expect");
  add(checks, "tool.api-tests", "API tests", hasAnyFile(cwd, ["tests/route-contracts.test.ts", "tests/api/route-contracts.ts"]), "API contract tests present.", "Missing API contract tests.", "tests");
  add(checks, "tool.proof", "Proof packet generator", hasScript(pkg, "test:proof") && existsSync(join(cwd, "scripts/generate-proof-packet.ts")), "Proof packet command present.", "Missing test:proof or generator script.", "scripts/generate-proof-packet.ts");

  add(checks, "design.tokens", "Design tokens", existsSync(join(cwd, profile.designSystem.tokensPath)), "Design tokens declared.", `Missing ${profile.designSystem.tokensPath}.`, profile.designSystem.tokensPath);
  add(checks, "design.system", "Design system registry", existsSync(join(cwd, profile.designSystem.systemPath)), "Design-system registry declared.", `Missing ${profile.designSystem.systemPath}.`, profile.designSystem.systemPath);
  add(checks, "design.no-inference", "No-inference design mode", profile.designSystem.mode === "no-inference", "AI design inference is disabled.", "Design mode permits unguided inference.", PROFILE_PATH, profile.designSystem.mode !== "no-inference");

  add(checks, "service.ai-gateway", "Vercel AI Gateway", !profile.services.vercelAiGateway?.enabled || hasPackage(pkg, "@ai-sdk/gateway"), "AI Gateway dependency present or service disabled.", "AI Gateway enabled but @ai-sdk/gateway is missing.", "package.json");
  add(checks, "service.supabase", "Supabase", !profile.services.supabase?.enabled || hasPackage(pkg, "@supabase/supabase-js"), "Supabase dependency present or service disabled.", "Supabase enabled but @supabase/supabase-js is missing.", "package.json");
  add(checks, "service.resend", "Resend", !profile.services.resend?.enabled || hasPackage(pkg, "resend"), "Resend dependency present or service disabled.", "Resend enabled but dependency is missing.", "package.json");
  add(checks, "service.stripe", "Stripe", !profile.services.stripe?.enabled || hasPackage(pkg, "stripe"), "Stripe dependency present or service disabled.", "Stripe enabled but dependency is missing.", "package.json");
  add(checks, "service.transcription", "Transcription vendors", (!profile.services.assemblyai?.enabled || hasPackage(pkg, "assemblyai")) && (!profile.services.deepgram?.enabled || hasPackage(pkg, "@deepgram/sdk")), "Transcription dependencies present or services disabled.", "AssemblyAI/Deepgram enabled but dependency missing.", "package.json");

  add(checks, "platform.capacitor", "Capacitor mobile", (!profile.platforms.ios?.enabled && !profile.platforms.android?.enabled) || (hasPackage(pkg, "@capacitor/core") && hasPackage(pkg, "@capacitor/ios") && hasPackage(pkg, "@capacitor/android")), "Capacitor mobile dependencies present.", "Mobile enabled but Capacitor dependencies are incomplete.", "package.json");
  add(checks, "platform.electron", "Electron desktop", (!profile.platforms.macos?.enabled && !profile.platforms.windows?.enabled) || hasPackage(pkg, "electron"), "Electron dependency present.", "Desktop enabled but electron is missing.", "package.json");
  add(checks, "platform.maestro", "Native flow harness", !profile.tools.maestro?.required || hasAnyFile(cwd, ["maestro.yaml", ".maestro"]), "Native flow harness present or not required yet.", "Maestro is required but no maestro.yaml/.maestro was found.", ".maestro", !profile.tools.maestro?.required);
  add(checks, "platform.native-config", "Native config proof", hasScript(pkg, "test:native:config") && existsSync(join(cwd, "scripts/check-native-config.ts")), "Native config proof command present.", "Missing test:native:config or native config checker.", "scripts/check-native-config.ts");
  add(checks, "platform.native-smoke", "Native smoke proof", hasScript(pkg, "test:native:smoke") && existsSync(join(cwd, "scripts/run-native-smoke.ts")), "Native smoke proof command present.", "Missing test:native:smoke or native smoke runner.", "scripts/run-native-smoke.ts");
  add(checks, "platform.release-artifacts", "Release artifact proof", hasScript(pkg, "build:release") && existsSync(join(cwd, "scripts/check-release-artifacts.ts")), "Release artifact proof command present.", "Missing build:release or release artifact checker.", "scripts/check-release-artifacts.ts");

  add(checks, "dashboard.dev-kit", "Dev-kit dashboard", existsSync(join(cwd, "app/dev-kit/page.tsx")) && existsSync(join(cwd, "app/api/dev-kit/status/route.ts")), "Dev-kit dashboard routes present.", "Missing /dev-kit dashboard routes.", "app/dev-kit");
  add(checks, "dashboard.project", "Project control panel", existsSync(join(cwd, "app/dev-kit/project/page.tsx")), "Project control panel present.", "Project control panel not installed yet.", "app/dev-kit/project/page.tsx", !existsSync(join(cwd, "app/dev-kit/project/page.tsx")));
  add(checks, "dashboard.proof", "Proof center", existsSync(join(cwd, "app/dev-kit/proof/page.tsx")) && existsSync(join(cwd, "app/api/dev-kit/proof/route.ts")), "Proof center routes present.", "Proof center not installed yet.", "app/dev-kit/proof/page.tsx", !existsSync(join(cwd, "app/dev-kit/proof/page.tsx")));

  const latestEvidence = newestFileMtime(cwd, ".evidence");
  checks.push({
    id: "proof.latest-evidence",
    label: "Latest local evidence",
    status: latestEvidence ? "pass" : "warn",
    detail: latestEvidence ? `Latest evidence updated ${latestEvidence}.` : "No local .evidence directory yet.",
    path: ".evidence",
  });

  return {
    generatedAt: new Date().toISOString(),
    profilePath: PROFILE_PATH,
    project: profile.project,
    branchModel: profile.branchModel,
    pass: checks.every(check => check.status !== "fail"),
    checks,
    enabledPlatforms,
    enabledServices,
    requiredTools,
  };
}

export function writeProjectHarnessReport(cwd = process.cwd()): string {
  const report = evaluateProjectHarness(cwd);
  const dir = join(cwd, ".evidence");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "project-harness.json");
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  return out;
}
