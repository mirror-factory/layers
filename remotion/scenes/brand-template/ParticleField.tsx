import React, { useEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Frame-deterministic particle field for the brand template.
 *
 * Each particle's position is a pure function of (frame, particle-index).
 * No integration, no `Math.random` per frame, no state — so Remotion can
 * render any frame in any order and get identical pixels. Equivalent in
 * spirit to the WebGL/GPGPU Atrium demo in
 * `branding/htmlcanvas-playground.html`, but in Canvas2D so it works inside
 * Remotion's puppeteer chromium without `<HtmlInCanvas>` gymnastics.
 *
 * Each particle:
 *   - has a base radius r0, initial angle φ, angular velocity ω
 *   - orbits with breathing radius: r(t) = r0 + amp * sin(wob * t + φ * 1.7)
 *   - is tinted one of the three signature wave colors (indigo / violet / mint)
 *   - fades in over `enterFrames`
 */

type Props = {
  /** Particle count. 1800 looks great at 1920×1080; bump for bigger surfaces. */
  count?: number;
  /** Center of the orbital field, in absolute pixels. */
  cx?: number;
  cy?: number;
  /** Min / max orbital radius in pixels. */
  rMin?: number;
  rMax?: number;
  /** Overall opacity multiplier. */
  alpha?: number;
  /** Frames to fade in. */
  enterFrames?: number;
  /** Per-particle seed offset, so two fields don't move in lock-step. */
  seedOffset?: number;
};

// Deterministic 1D hash — same family as the shader-side `hash11`. Returns
// a number in [0, 1). Stable for any integer-keyed input.
function hash(n: number): number {
  let x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const COLORS: Array<{ rgb: string; weight: number }> = [
  { rgb: "99, 102, 241", weight: 0.55 },   // indigo (wave-indigo)
  { rgb: "196, 181, 253", weight: 0.30 },  // violet-soft (wave-violet)
  { rgb: "52, 211, 153", weight: 0.15 },   // mint (wave-mint)
];

export const ParticleField: React.FC<Props> = ({
  count = 1800,
  cx,
  cy,
  rMin = 80,
  rMax = 460,
  alpha = 0.85,
  enterFrames = 24,
  seedOffset = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const centerX = cx ?? width * 0.5;
  const centerY = cy ?? height * 0.5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const t = frame / fps;
    const enter = Math.max(0, Math.min(1, frame / enterFrames));

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < count; i++) {
      const seed = i + 1 + seedOffset * 9999;
      const r0 = rMin + (rMax - rMin) * hash(seed);
      const φ = hash(seed * 2.13) * Math.PI * 2;
      // Orbital ω: faster near center (Kepler-ish feel), slower far out.
      const ω = (0.05 + 0.18 * (1 - r0 / rMax)) * (hash(seed * 3.07) < 0.5 ? 1 : -1);
      // Breathing radius
      const wob = 0.6 + hash(seed * 4.13) * 1.8;
      const wobAmp = 8 + hash(seed * 5.11) * 26;
      const r = r0 + wobAmp * Math.sin(wob * t + φ * 1.7);

      const θ = φ + ω * t;
      const x = centerX + r * Math.cos(θ);
      const y = centerY + r * Math.sin(θ);

      // Tint
      const tintRoll = hash(seed * 6.91);
      let tint = COLORS[0].rgb;
      let cum = 0;
      for (const c of COLORS) {
        cum += c.weight;
        if (tintRoll < cum) { tint = c.rgb; break; }
      }

      const size = 1.0 + hash(seed * 7.19) * 1.8;
      const baseA = 0.18 + 0.55 * (1 - r0 / rMax); // closer = brighter
      const fade = baseA * alpha * enter;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${tint}, ${fade})`;
      ctx.fill();

      // Soft halo around mint accent particles only
      if (tint === COLORS[2].rgb) {
        ctx.beginPath();
        ctx.arc(x, y, size * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${tint}, ${fade * 0.18})`;
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = "source-over";
  }, [frame, width, height, fps, count, centerX, centerY, rMin, rMax, alpha, enterFrames, seedOffset]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      aria-hidden
    />
  );
};
