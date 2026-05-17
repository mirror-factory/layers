import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  spring,
  useVideoConfig,
} from "remotion";
import { TOKENS, FONT_EMPHASIS_SANS } from "../../lib/tokens";
import { ApertureLogo } from "../../components/ApertureLogo";

/**
 * Scene 05 (28-32s, 120f) — Mirror Factory aperture.
 *
 * Aperture/logo draws itself in, the tagline fades in below, and the wordmark
 * sits beneath. Mint is the only chroma on the frame — everything else stays
 * paper-calm.
 */
export const Aperture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The aperture "opens" with a smooth spring (no bounce — feel-good logo, not
  // a UI ping).
  const open = spring({
    frame,
    fps,
    config: { damping: 200, mass: 1.1 },
    durationInFrames: 50,
  });

  const taglineFade = interpolate(frame, [40, 76], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const taglineLift = interpolate(frame, [40, 76], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const wordmarkFade = interpolate(frame, [62, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Gentle end-of-video soften so the last frame isn't a hard cut to black.
  const endFade = interpolate(frame, [100, 120], [1, 0.88], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 40,
        opacity: endFade,
      }}
    >
      <ApertureLogo size={240} progress={open} />

      <div
        style={{
          opacity: taglineFade,
          transform: `translateY(${taglineLift}px)`,
          textAlign: "center",
          maxWidth: 1280,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 72,
            color: TOKENS.ink,
            letterSpacing: "-0.022em",
            lineHeight: 1.1,
            fontFamily: FONT_EMPHASIS_SANS,
            fontStyle: "normal",
            fontWeight: 650,
          }}
        >
          Context, wherever you are.
        </h2>
      </div>

      <div
        style={{
          opacity: wordmarkFade,
          fontSize: 18,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: TOKENS.fgMuted,
        }}
      >
        Mirror Factory
      </div>
    </AbsoluteFill>
  );
};
