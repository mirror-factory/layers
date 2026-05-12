import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { TOKENS, FONT_ITALIC_SERIF } from "../../lib/tokens";

/**
 * Scene 01 (0-4s) — "Wherever you are."
 *
 * Black-on-cream paper-calm. The phrase fades in slowly with a 24f hold at
 * full opacity, then begins to soften so the next scene can take over without
 * a hard cut. No motion sparkle. The eye should land here.
 */
export const Phrase: React.FC = () => {
  const frame = useCurrentFrame();

  // Slow fade-in over 1.8s, hold, then gentle handoff to scene 2.
  const enter = interpolate(frame, [4, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const drift = interpolate(frame, [4, 110], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const exit = interpolate(frame, [96, 118], [1, 0.7], {
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
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 132,
          fontWeight: 400,
          color: TOKENS.ink,
          letterSpacing: "-0.022em",
          textAlign: "center",
          opacity: enter * exit,
          transform: `translateY(${drift}px)`,
          maxWidth: 1500,
          lineHeight: 1.04,
          fontFamily: FONT_ITALIC_SERIF,
          fontStyle: "italic",
        }}
      >
        Wherever you are.
      </h1>
    </AbsoluteFill>
  );
};
