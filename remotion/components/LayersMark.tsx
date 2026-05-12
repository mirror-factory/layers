import React from "react";
import { TOKENS } from "../lib/tokens";

/**
 * Layers aperture mark. Mirrors components/layers-logo.tsx but takes plain
 * props so it can be used inside Remotion without the design-system CSS chain.
 */
export const LayersMark: React.FC<{
  size?: number;
  strokeWidth?: number;
}> = ({ size = 64, strokeWidth = 2.6 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path
        d="M16 4 a12 12 0 1 1 0 24"
        fill="none"
        stroke={TOKENS.layersBlue}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
      <path
        d="M16 8.5 a7.5 7.5 0 1 1 0 15"
        fill="none"
        stroke={TOKENS.layersViolet}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
      <circle cx={16} cy={16} r={4} fill={TOKENS.layersMint} opacity={0.22} />
      <circle cx={16} cy={16} r={2} fill={TOKENS.layersMint} />
    </svg>
  );
};
