import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BEATS } from "./timing";
import { ColdOpen } from "./ColdOpen";
import { Wedge } from "./Wedge";
import { FaceToDot } from "./FaceToDot";
import { Layers } from "./Layers";
import { ContextFlow } from "./ContextFlow";
import { Outro } from "./Outro";

/**
 * `BrandTemplate` — PROD-499.
 *
 * The canonical Layers brand video template. Six beats, each its own
 * Sequence, with half-second crossfade overlaps so motion never hard-cuts.
 * Forkable — duplicate this folder and rearrange / replace beats for a new
 * piece (release reel, recap, social cutdown). The matching skill
 * `.claude/skills/layers-brand-remotion/SKILL.md` documents conventions.
 */
export const BrandTemplateComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "oklch(0.982 0.012 168)" }}>
      <Sequence from={BEATS.coldOpen.from} durationInFrames={BEATS.coldOpen.duration} name="cold-open">
        <ColdOpen />
      </Sequence>
      <Sequence from={BEATS.wedge.from} durationInFrames={BEATS.wedge.duration} name="wedge">
        <Wedge />
      </Sequence>
      <Sequence from={BEATS.faceToDot.from} durationInFrames={BEATS.faceToDot.duration} name="face-to-dot">
        <FaceToDot />
      </Sequence>
      <Sequence from={BEATS.layers.from} durationInFrames={BEATS.layers.duration} name="layers">
        <Layers />
      </Sequence>
      <Sequence from={BEATS.contextFlow.from} durationInFrames={BEATS.contextFlow.duration} name="context-flow">
        <ContextFlow />
      </Sequence>
      <Sequence from={BEATS.outro.from} durationInFrames={BEATS.outro.duration} name="outro">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
