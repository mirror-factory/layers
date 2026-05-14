import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TOKENS } from "../../lib/tokens";
import { PaperBackground } from "../../components/PaperBackground";
import { AudioWave } from "../../components/AudioWave";
import { OrganicLayersMark } from "./OrganicRing";

/**
 * BEAT 1 — Cold open (~4s).
 *
 * Warm paper, the audio-wave ribbon settling in beneath the title, the
 * organic Layers mark drawing itself, and the wordmark with the brand's
 * canonical italic-serif emphasis.
 */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const seconds = frame / fps;

  // Mark draws in over the first 30 frames.
  const markEnter = interpolate(frame, [4, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Wordmark fades in just after.
  const wordEnter = interpolate(frame, [22, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineEnter = interpolate(frame, [54, 86], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Whole scene fades out into the wedge crossfade.
  const out = interpolate(frame, [100, 120], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The mark's organic phase advances with the scene's clock so it lives.
  const markPhase = seconds * 0.8;

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <PaperBackground />

      {/* Audio wave settling beneath the title — quiet idle */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: height * 0.66,
          height: 220,
          opacity: 0.85 * markEnter,
        }}
      >
        <AudioWave width={width} height={220} level={0.15} motion={0.6} minimal />
      </div>

      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 28 }}
      >
        <div
          style={{
            transform: `scale(${0.86 + markEnter * 0.14})`,
            opacity: markEnter,
          }}
        >
          <OrganicLayersMark size={172} phase={markPhase} strokeWidth={3.2} />
        </div>

        <div
          style={{
            opacity: wordEnter,
            transform: `translateY(${(1 - wordEnter) * 12}px)`,
            fontWeight: 600,
            fontSize: 104,
            letterSpacing: "-0.025em",
            color: TOKENS.ink,
            lineHeight: 1,
          }}
        >
          Layers
        </div>

        <div
          style={{
            opacity: taglineEnter,
            transform: `translateY(${(1 - taglineEnter) * 8}px)`,
            fontSize: 26,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: TOKENS.fgMuted,
            fontWeight: 500,
          }}
        >
          Your context — layered.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
