import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { ProjectHarnessReport } from "./project-profile";

export interface ProofArtifact {
  path: string;
  bytes: number;
  modifiedAt: string;
  checksum?: string;
}

export interface ArtifactProvenance extends ProofArtifact {
  artifactId: string;
  taskIds: string[];
  featureIds: string[];
  laneId: string;
  command: string;
  source: "expect" | "playwright" | "remotion" | "native" | "proof-packet" | "release";
  branch: string;
  commit: string;
  platform: string;
  capturedAt: string;
  reviewUrl: string;
  href: string;
  kind: "json" | "image" | "video" | "trace" | "directory" | "report" | "artifact";
  pass?: boolean;
  state: "green" | "blocked" | "pending";
  tags: string[];
  runId?: string | null;
  missing: string[];
}

export interface ProofStatusSummary {
  path: string;
  pass?: boolean;
  status?: string;
  mode?: string;
  skipped?: boolean;
  required?: boolean;
  runAt?: string;
  durationMs?: number;
  exitCode?: number;
  tuiTimedOutWithoutSteps?: boolean;
  fallbackPass?: boolean;
  fallbackCommandCount?: number;
  fallbackFailedCommandCount?: number;
  booleanFields?: Record<string, boolean>;
}

export interface ProofTierSummary extends ProofStatusSummary {
  tier?: number;
  gateCount?: number;
  passedGates?: number;
  failedGates?: number;
  skippedGates?: number;
  totalDurationMs?: number;
}

export interface ProofNativeConfigSummary extends ProofStatusSummary {
  enabledNativePlatforms?: string[];
  artifactCount?: number;
  checkCount?: number;
  failedChecks?: number;
  warningChecks?: number;
}

export interface ProofRunnerCapabilitySummary extends ProofStatusSummary {
  platform?: string;
  arch?: string;
  githubActions?: boolean;
  readiness?: Record<string, boolean>;
  checks?: Record<string, boolean>;
}

export interface ProofSummary {
  expectProof?: ProofStatusSummary;
  tiers?: ProofTierSummary[];
  nativeConfig?: ProofNativeConfigSummary;
  runnerCapability?: ProofRunnerCapabilitySummary;
}

export interface ProofPacket {
  generatedAt: string;
  projectHarness?: ProjectHarnessReport;
  git?: {
    branch?: string | null;
    head?: string | null;
    status?: string | null;
    changedFiles?: string[];
  };
  summary?: ProofSummary;
  featureProof?: {
    generatedAt?: string;
    changedFiles?: string[];
    matchedFeatures?: Array<{
      id: string;
      name: string;
      userFacing?: boolean;
      surfaces?: string[];
      proof?: string[];
      matchedPaths?: string[];
    }>;
    unmatchedUserFacingFiles?: string[];
    requiredLanes?: Array<{
      id: string;
      label: string;
      command: string;
      evidence?: string[];
      satisfied?: boolean;
      missingEvidence?: string[];
    }>;
    pass?: boolean;
    blocked?: {
      unregisteredUserFacingChange?: boolean;
      missingArtifactLanes?: string[];
    };
  } | null;
  evidence?: ProofArtifact[];
  testResults?: ProofArtifact[];
  browserArtifacts?: ProofArtifact[];
  nativeArtifacts?: ProofArtifact[];
  remotionArtifacts?: ProofArtifact[];
  artifactProvenance?: ArtifactProvenance[];
  starter?: {
    scorecard?: string | null;
    browserProof?: string | null;
  };
}

export interface LatestProofPacket {
  present: boolean;
  path: string;
  updatedAt: string | null;
  packet: ProofPacket | null;
  error?: string;
}

export function proofPacketPath(cwd: string = process.cwd()): string {
  return join(cwd, ".evidence", "proof-packet.json");
}

export function loadLatestProofPacket(cwd: string = process.cwd()): LatestProofPacket {
  const path = proofPacketPath(cwd);
  if (!existsSync(path)) {
    return {
      present: false,
      path,
      updatedAt: null,
      packet: null,
    };
  }

  try {
    const stat = statSync(path);
    return {
      present: true,
      path,
      updatedAt: stat.mtime.toISOString(),
      packet: JSON.parse(readFileSync(path, "utf-8")) as ProofPacket,
    };
  } catch (error) {
    return {
      present: true,
      path,
      updatedAt: null,
      packet: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
