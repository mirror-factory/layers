import React from "react";
import { TOKENS } from "../lib/tokens";

/**
 * Mirror Factory aperture. A larger, quieter sibling of `LayersMark` used as
 * the closing logo for the PROD-480 intro video. Same geometric language
 * (three concentric arcs + a center dot) but mint is the only accent and the
 * outer arcs use ink-at-low-opacity so the eye rests on the center.
 *
 * Pass `progress` (0-1) to draw the arcs in — used by the closing scene so
 * the aperture "opens" instead of popping.
 */
export const ApertureLogo: React.FC<{
  size?: number;
  progress?: number;
  strokeWidth?: number;
}> = ({ size = 220, progress = 1, strokeWidth = 2.2 }) => {
  const p = Math.max(0, Math.min(1, progress));
  // Circumferences for stroke-dash draw-in. 2*PI*r for each arc.
  // Outer: r=24 → ~150.8; Middle: r=17 → ~106.8.
  const outerLen = 2 * Math.PI * 24;
  const middleLen = 2 * Math.PI * 17;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        <filter id="aperture-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* Quiet halo behind the mark so it reads on paper without a hard edge */}
      <circle
        cx={32}
        cy={32}
        r={22}
        fill={TOKENS.layersMintTint}
        opacity={0.55 * p}
        filter="url(#aperture-soft-glow)"
      />

      {/* Outer ring — ink, restrained. Stroke-dash draws it in around the full
       *  circumference; transform rotates so the draw-in starts at the top. */}
      <circle
        cx={32}
        cy={32}
        r={24}
        fill="none"
        stroke={TOKENS.ink}
        strokeOpacity={0.45}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        strokeDasharray={outerLen}
        strokeDashoffset={outerLen * (1 - p)}
        transform="rotate(-90 32 32)"
      />

      {/* Middle ring — also ink, slightly darker */}
      <circle
        cx={32}
        cy={32}
        r={17}
        fill="none"
        stroke={TOKENS.ink}
        strokeOpacity={0.62}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        strokeDasharray={middleLen}
        strokeDashoffset={middleLen * (1 - Math.max(0, (p - 0.15) / 0.85))}
        transform="rotate(-90 32 32)"
      />

      {/* Mint center — the only chroma on the frame */}
      <circle
        cx={32}
        cy={32}
        r={8}
        fill={TOKENS.layersMint}
        opacity={0.16 * p}
      />
      <circle
        cx={32}
        cy={32}
        r={4}
        fill={TOKENS.layersMint}
        opacity={Math.max(0, (p - 0.4) / 0.6)}
      />
    </svg>
  );
};
