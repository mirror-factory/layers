import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { TOKENS, FONT_EMPHASIS_SANS } from "../lib/tokens";
import { LayersMark } from "../components/LayersMark";

/**
 * Scene 05 (78-85s) — CTA close.
 *
 * "Currently in invite-only alpha. Email admin@mirafactory.ai for access."
 *
 * The aperture mark fades in big, scale settles, then the copy types in below.
 * One mint pill underneath holds the email — that's it. Nothing else on the
 * frame because the eye should rest here.
 */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();

  // Window starts before frame 0 so the mark is already partially visible at
  // the scene boundary, eliminating the "blank paper" hole.
  const markEnter = interpolate(frame, [-8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const markScale = interpolate(markEnter, [0, 1], [0.85, 1]);
  const markOpacity = markEnter;

  const headlineFade = interpolate(frame, [22, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaFade = interpolate(frame, [62, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finalSlowFade = interpolate(frame, [180, 210], [1, 0.92], {
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
        opacity: finalSlowFade,
      }}
    >
      <div
        style={{
          opacity: markOpacity,
          transform: `scale(${markScale})`,
          marginBottom: 48,
        }}
      >
        <LayersMark size={128} strokeWidth={2.4} />
      </div>

      <h2
        style={{
          opacity: headlineFade,
          fontSize: 64,
          margin: 0,
          color: TOKENS.ink,
          fontWeight: 600,
          letterSpacing: "-0.022em",
          textAlign: "center",
          lineHeight: 1.1,
          maxWidth: 1240,
        }}
      >
        Currently in{" "}
        <em
          style={{
            fontFamily: FONT_EMPHASIS_SANS,
            fontStyle: "normal",
            fontWeight: 650,
            color: TOKENS.layersMint,
          }}
        >
          invite-only alpha.
        </em>
      </h2>

      <div
        style={{
          opacity: ctaFade,
          marginTop: 36,
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 28px",
          background: `color-mix(in oklch, ${TOKENS.layersMintTint} 65%, ${TOKENS.bgSurface} 35%)`,
          border: `1px solid color-mix(in oklch, ${TOKENS.layersMint} 50%, ${TOKENS.borderDefault} 50%)`,
          borderRadius: 999,
          fontSize: 26,
          color: TOKENS.ink,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          boxShadow: `0 12px 28px -16px color-mix(in oklch, ${TOKENS.layersMint} 36%, transparent)`,
        }}
      >
        Email{" "}
        <span style={{ fontWeight: 700 }}>admin@mirafactory.ai</span> for access.
      </div>
    </AbsoluteFill>
  );
};
