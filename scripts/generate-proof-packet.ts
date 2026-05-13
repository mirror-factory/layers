#!/usr/bin/env tsx
/**
 * Generate a compact proof packet and artifact provenance manifest from the
 * latest local evidence.
 *
 * This does not run tests. It gathers the artifacts produced by the tier
 * runner so a PR, Linear ticket, or Symphony dashboard can link one proof
 * packet plus one task-owned artifact manifest.
 */

import { generateProofPacket } from '../lib/ai-dev-kit/proof-packet';

const { path, packet } = generateProofPacket(process.cwd());

console.log(`[generate-proof-packet] wrote ${path}`);
console.log(
  `[generate-proof-packet] evidence=${packet.evidence?.length ?? 0} browser=${packet.browserArtifacts?.length ?? 0} native=${packet.nativeArtifacts?.length ?? 0} provenance=${packet.artifactProvenance?.length ?? 0}`,
);
