import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { TOKENS } from "../lib/tokens";

/**
 * Frame-deterministic recreation of the brand's audio-wave ribbon.
 *
 * The product uses a canvas + RAF ribbon (components/audio-wave-ribbon.tsx)
 * which is not frame-deterministic — Remotion needs every animation parameter
 * to be a pure function of frame so each rendered frame is reproducible. This
 * component mirrors the canvas ribbon's visual signature (three layered
 * sine-based curves, mint primary + violet/blue accents, soft halo) using SVG
 * paths whose phase advances with the current frame.
 */

type Props = {
  width: number;
  height: number;
  /** 0-1 — how much the ribbon "responds" to audio. 0 = idle breath, 1 = peak */
  level?: number;
  /** Scales overall motion speed for slow-mo or busy beats */
  motion?: number;
  /** Disable layered violet/blue echoes for a quieter "idle" look */
  minimal?: boolean;
};

function buildPath(
  width: number,
  height: number,
  phase: number,
  amplitude: number,
  step: number,
  offset = 0,
): string {
  const centerY = height / 2;
  const points: Array<[number, number]> = [];
  for (let x = -step; x <= width + step; x += step) {
    const normalized = x / Math.max(width, 1);
    const drift = Math.sin(normalized * Math.PI * 1.62 + phase * 0.72 + offset);
    const weave = Math.sin(
      normalized * Math.PI * 4.15 - phase * 1.08 + offset * 0.55,
    );
    const fine = Math.sin(normalized * Math.PI * 8.8 + phase * 0.58);
    const undertow = Math.sin(normalized * Math.PI * 0.86 - phase + offset * 0.4);

    const y =
      centerY +
      drift * amplitude * 0.56 +
      weave * amplitude * 0.34 +
      fine * amplitude * 0.035 +
      undertow * amplitude * 0.16;
    points.push([x, y]);
  }

  // Smooth Bezier between sample points — same approach as the canvas ribbon.
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export const AudioWave: React.FC<Props> = ({
  width,
  height,
  level = 0.45,
  motion = 1,
  minimal = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  // Idle breath layered with the active "level" — same shape as the canvas ribbon.
  const energy = Math.min(1, level + 0.08);
  const breath = 0.93 + 0.07 * Math.sin(seconds * 2.4 * motion);
  const baseAmp = height * 0.086 * Math.min(1.48, motion);
  const soundAmp = height * 0.15 * energy;
  const amplitude = (baseAmp + soundAmp) * breath;
  const phase = seconds * 1.9 * motion;

  // Subtle vertical motion adds the "alive" sense without bouncing the layout.
  const drift = interpolate(
    Math.sin(seconds * 0.4),
    [-1, 1],
    [-2, 2],
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", transform: `translateY(${drift}px)` }}
    >
      <defs>
        <filter id="wave-soft-blur" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* Soft mint halo */}
      <path
        d={buildPath(width, height, phase * 0.9, amplitude, 16, 0.9)}
        stroke={TOKENS.layersMint}
        strokeWidth={26}
        strokeLinecap="round"
        fill="none"
        opacity={0.18}
        filter="url(#wave-soft-blur)"
      />

      {!minimal && (
        <>
          {/* Violet echo */}
          <path
            d={buildPath(width, height, phase * 1.04, amplitude * 0.95, 14, 2.2)}
            stroke={TOKENS.layersVioletSoft}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            opacity={0.55}
          />
          {/* Blue echo */}
          <path
            d={buildPath(width, height, phase * 0.85, amplitude * 0.9, 14, -1.4)}
            stroke={TOKENS.layersBlueSoft}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
            opacity={0.4}
          />
        </>
      )}

      {/* Primary ink line — quiet, just enough presence to read */}
      <path
        d={buildPath(width, height, phase, amplitude, 12, 0)}
        stroke={TOKENS.ink}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
        opacity={0.32}
      />
      {/* Mint hero stroke */}
      <path
        d={buildPath(width, height, phase, amplitude, 12, 0)}
        stroke={TOKENS.layersMint}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.95}
      />
      {/* Whisper of white highlight, gives it the wet-ink shimmer */}
      <path
        d={buildPath(width, height, phase, amplitude, 12, 0.18)}
        stroke="rgba(255, 255, 255, 0.78)"
        strokeWidth={0.9}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};
