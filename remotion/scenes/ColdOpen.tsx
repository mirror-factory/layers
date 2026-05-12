import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TOKENS, FONT_ITALIC_SERIF } from "../lib/tokens";
import { AudioWave } from "../components/AudioWave";
import { LayersMark } from "../components/LayersMark";

/**
 * Scene 00 (0-6s) — title card.
 *
 *   "AI memory for your meetings."
 *
 * The audio-wave ribbon enters first as a thin mint line then breathes open
 * into its full layered form. Title fades in just behind it. Restraint as a
 * design move: a single centered mark, italic display for emphasis, no other
 * chrome.
 */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const waveOpen = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 60,
  });

  const titleFade = interpolate(frame, [16, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [16, 50], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const markFade = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subFade = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const waveLevel = 0.25 + 0.18 * waveOpen;
  const waveWidth = Math.round(width * 0.6);
  const waveHeight = Math.round(height * 0.16);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div style={{ opacity: markFade, marginBottom: 36 }}>
        <LayersMark size={64} />
      </div>

      <div
        style={{
          opacity: waveOpen,
          marginBottom: 56,
          transform: `scaleY(${0.6 + 0.4 * waveOpen})`,
          transformOrigin: "center",
        }}
      >
        <AudioWave
          width={waveWidth}
          height={waveHeight}
          level={waveLevel}
          motion={0.9}
        />
      </div>

      <h1
        style={{
          fontSize: 116,
          margin: 0,
          color: TOKENS.ink,
          fontWeight: 600,
          letterSpacing: "-0.028em",
          lineHeight: 1.02,
          textAlign: "center",
          opacity: titleFade,
          transform: `translateY(${titleY}px)`,
          maxWidth: 1400,
        }}
      >
        AI memory for your{" "}
        <em
          style={{
            fontFamily: FONT_ITALIC_SERIF,
            fontStyle: "italic",
            fontWeight: 400,
            color: TOKENS.layersMint,
            letterSpacing: "-0.012em",
          }}
        >
          meetings.
        </em>
      </h1>

      <p
        style={{
          opacity: subFade,
          marginTop: 32,
          fontSize: 28,
          color: TOKENS.fgMuted,
          letterSpacing: "-0.005em",
          maxWidth: 720,
          textAlign: "center",
          lineHeight: 1.45,
        }}
      >
        Decisions that move work forward.
      </p>
    </AbsoluteFill>
  );
};
