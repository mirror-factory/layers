import React from "react";

/**
 * Frame-deterministic organic ring — same family as the audio-wave ribbon.
 *
 * Renders a closed path whose radius is sine-modulated:
 *   r(θ) = baseR + amp * (0.62 * sin(lobesA * θ + phase)
 *                       + 0.38 * sin(lobesB * θ - phase * 1.7))
 *
 * Used by the brand template's "you are the dot" + "layers accumulate" beats.
 * Phase must be a pure function of the current frame so renders are stable.
 */

type Props = {
  cx: number;
  cy: number;
  baseR: number;
  amp?: number;
  lobesA?: number;
  lobesB?: number;
  phase: number;
  samples?: number;
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
  strokeDasharray?: string;
  strokeDashoffset?: number;
  fill?: string;
  filter?: string;
};

export const OrganicRing: React.FC<Props> = ({
  cx,
  cy,
  baseR,
  amp = baseR * 0.06,
  lobesA = 3,
  lobesB = 5,
  phase,
  samples = 120,
  stroke,
  strokeWidth = 2,
  opacity = 1,
  strokeDasharray,
  strokeDashoffset,
  fill = "none",
  filter,
}) => {
  const TAU = Math.PI * 2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * TAU;
    const r =
      baseR +
      amp * 0.62 * Math.sin(lobesA * t + phase) +
      amp * 0.38 * Math.sin(lobesB * t - phase * 1.7);
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }

  // Catmull-Rom → Bezier (same approach as remotion/components/AudioWave.tsx).
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[pts.length - 2];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? pts[1];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  d += " Z";

  return (
    <path
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
      fill={fill}
      opacity={opacity}
      filter={filter}
    />
  );
};

/**
 * Open semi-circle arc, organic-line variant. Same family as the original
 * `components/layers-logo.tsx` arcs (which span 180° opening toward the
 * mint center), but the radius is sine-modulated each frame for a flowing
 * organic feel. Pass `startAngle`/`endAngle` to control the span; defaults
 * are -π/2 → π/2 (top → bottom through right), matching the production
 * logo's semi-circle pattern.
 */
type ArcProps = Props & { startAngle?: number; endAngle?: number };

export const OrganicArc: React.FC<ArcProps> = ({
  cx,
  cy,
  baseR,
  amp = baseR * 0.075,
  lobesA = 3,
  lobesB = 5,
  phase,
  samples = 64,
  stroke,
  strokeWidth = 2,
  opacity = 1,
  strokeDasharray,
  strokeDashoffset,
  fill = "none",
  filter,
  startAngle = -Math.PI / 2,
  endAngle = Math.PI / 2,
}) => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const θ = startAngle + (endAngle - startAngle) * t;
    const r =
      baseR +
      amp * 0.62 * Math.sin(lobesA * θ + phase) +
      amp * 0.38 * Math.sin(lobesB * θ - phase * 1.7);
    pts.push([cx + r * Math.cos(θ), cy + r * Math.sin(θ)]);
  }

  // Catmull-Rom → Bezier, open path (no closing Z).
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? pts[i + 1];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }

  return (
    <path
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
      fill={fill}
      opacity={opacity}
      filter={filter}
    />
  );
};

/**
 * The organic semi-circle Layers mark — the proposed replacement for
 * `components/layers-logo.tsx`. Same structure as production: blue outer
 * semi-circle, violet middle semi-circle, mint center dot. Difference: each
 * arc is a flowing organic line rather than a perfect arc, animated by
 * `phase`. Frame-deterministic equivalent of the JS variant in
 * `branding/design-kit.html`.
 */
export const OrganicLayersMark: React.FC<{
  size?: number;
  phase: number;
  strokeWidth?: number;
}> = ({ size = 96, phase, strokeWidth = 3 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <OrganicArc
        cx={32}
        cy={32}
        baseR={22.0}
        amp={1.7}
        lobesA={3}
        lobesB={5}
        phase={phase}
        stroke="oklch(0.66 0.13 240)"
        strokeWidth={strokeWidth}
      />
      <OrganicArc
        cx={32}
        cy={32}
        baseR={13.5}
        amp={1.4}
        lobesA={4}
        lobesB={6}
        phase={phase + 1.2}
        stroke="oklch(0.66 0.16 282)"
        strokeWidth={strokeWidth}
      />
      <circle cx={32} cy={32} r={9} fill="oklch(0.68 0.13 166)" opacity={0.22} />
      <circle cx={32} cy={32} r={4.4} fill="oklch(0.68 0.13 166)" />
    </svg>
  );
};
