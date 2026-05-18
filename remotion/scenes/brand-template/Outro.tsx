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
import { ParticleField } from "./ParticleField";

/**
 * BEAT 6 — Outro (~6s).
 *
 * The organic Layers mark with the wordmark and the tagline,
 * sitting on warm paper, a quiet audio wave underneath. No music swell,
 * no "available now." Quiet, confident, inevitable.
 */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const seconds = frame / fps;

  const enter = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineEnter = interpolate(frame, [40, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlEnter = interpolate(frame, [88, 126], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <PaperBackground />
      {/* Quiet particle atmosphere — feels like an after-image of the
        * layers that just gathered.
        */}
      <ParticleField
        count={900}
        rMin={140}
        rMax={Math.min(width, height) * 0.5}
        alpha={0.32}
        enterFrames={30}
        seedOffset={2}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: height * 0.66,
          height: 220,
          opacity: 0.65,
        }}
      >
        <AudioWave width={width} height={220} level={0.1} motion={0.5} minimal />
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24 }}>
        <OrganicLayersMark size={186} phase={seconds * 0.6} strokeWidth={3.4} />

        <div
          style={{
            fontWeight: 600,
            fontSize: 108,
            letterSpacing: "-0.025em",
            color: TOKENS.ink,
            lineHeight: 1,
            marginTop: 16,
          }}
        >
          Layers
        </div>

        <div
          style={{
            opacity: taglineEnter,
            transform: `translateY(${(1 - taglineEnter) * 8}px)`,
            fontSize: 32,
            color: TOKENS.fgMuted,
            letterSpacing: "-0.005em",
          }}
        >
          Your context, layered.
        </div>

        <div
          style={{
            opacity: urlEnter,
            marginTop: 22,
            fontFamily: `"JetBrains Mono", "SF Mono", ui-monospace, monospace`,
            fontSize: 18,
            letterSpacing: "0.08em",
            color: TOKENS.layersViolet,
          }}
        >
          layers.mirrorfactory.ai
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
