import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { ProjectHarnessReport } from "./project-profile";

export interface ProofArtifact {
  path: string;
  bytes: number;
  modifiedAt: string;
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
  evidence?: ProofArtifact[];
  testResults?: ProofArtifact[];
  browserArtifacts?: ProofArtifact[];
  nativeArtifacts?: ProofArtifact[];
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

