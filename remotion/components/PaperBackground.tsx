import React from "react";
import { AbsoluteFill } from "remotion";
import { TOKENS } from "../lib/tokens";

/**
 * Paper Calm background. Soft warm paper, a barely-there mint wash near the
 * horizon, and a single subtle radial that gives the frame the same depth as
 * landing.tsx without any AI sparkle gradient.
 */
export const PaperBackground: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  return (
    <AbsoluteFill style={{ background: TOKENS.bgPage }}>
      {/* Mint wash high in the frame — keeps the eye drawn upward */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 18%, ${TOKENS.layersMintTint} 0%, transparent 55%)`,
          opacity: 0.7,
        }}
      />
      {/* Whisper of violet from the right edge — single accent, not a wash */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 92% 86%, ${TOKENS.layersVioletTint} 0%, transparent 35%)`,
          opacity: 0.45,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/**
 * Hand-drawn flourish — used exactly once across the video for emphasis.
 * Granola's homepage uses a single scribble; we don't want three. Renders as
 * a stroke-dash animated SVG so it can "draw itself" if a `progress` (0-1) is
 * passed.
 */
export const HandwrittenAccent: React.FC<{
  label: string;
  progress?: number;
  color?: string;
}> = ({ label, progress = 1, color = TOKENS.layersMint }) => {
  const totalLen = 220;
  const dash = totalLen * Math.max(0, Math.min(1, progress));

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        color,
        fontFamily: `"Caveat", "Bradley Hand", "Marker Felt", cursive`,
        fontSize: 36,
        fontWeight: 600,
        letterSpacing: "0.005em",
        opacity: progress > 0.05 ? 1 : 0,
      }}
    >
      <svg width={140} height={42} viewBox="0 0 140 42" aria-hidden>
        <path
          d="M4 28 C 22 8, 60 8, 88 22 S 124 32, 136 18"
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={totalLen}
          strokeDashoffset={totalLen - dash}
        />
        <path
          d="M126 12 L 136 18 L 128 26"
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={progress > 0.85 ? 1 : 0}
        />
      </svg>
      <span style={{ transform: "translateY(-2px)" }}>{label}</span>
    </div>
  );
};
