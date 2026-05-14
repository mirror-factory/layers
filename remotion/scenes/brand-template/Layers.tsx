import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TOKENS } from "../../lib/tokens";
import { PaperBackground } from "../../components/PaperBackground";
import { OrganicRing } from "./OrganicRing";
import { ParticleField } from "./ParticleField";

/**
 * BEAT 4 — Layers accumulate (~8s).
 *
 * From the mint dot at center, organic rings expand outward in sequence,
 * each labeled with the source of a layer: meeting, email, browser, doc,
 * file. The accumulation is the metaphor: every recording, every read,
 * every conversation adds another ring to your library.
 */

const LAYERS = [
  { delay: 6,   label: "Meeting · pricing call · Thu",       color: TOKENS.layersViolet,     baseR: 110 },
  { delay: 38,  label: "Email · onboarding thread",          color: TOKENS.layersVioletSoft, baseR: 190 },
  { delay: 70,  label: "Browser · competitive research",     color: TOKENS.layersBlueSoft,   baseR: 280 },
  { delay: 102, label: "Doc · pricing-rationale.md",         color: TOKENS.layersBlue,       baseR: 380 },
  { delay: 134, label: "Library · 14 layers · indexed",      color: TOKENS.ink,              baseR: 480 },
];

export const Layers: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = interpolate(frame, [200, 240], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cx = width * 0.5;
  const cy = height * 0.5;
  const phaseBase = (frame / fps) * 0.6;

  // Caption (banner left side)
  const captionEnter = interpolate(frame, [4, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: Math.min(enter, out) }}>
      <PaperBackground />
      {/* Particle field — orbital cloud anchored at center, hints at the
        * "context layers" the rings will name. Frame-deterministic.
        */}
      <ParticleField
        count={1600}
        cx={cx}
        cy={cy}
        rMin={120}
        rMax={Math.min(width, height) * 0.55}
        alpha={0.55}
        enterFrames={20}
      />

      <AbsoluteFill style={{ padding: 110, alignItems: "flex-start", justifyContent: "flex-start" }}>
        <div style={{ opacity: captionEnter, transform: `translateY(${(1 - captionEnter) * 12}px)` }}>
          <div style={{ fontSize: 18, letterSpacing: "0.18em", textTransform: "uppercase", color: TOKENS.fgFaint, marginBottom: 10 }}>
            03 — Layers accumulate
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: TOKENS.ink,
              maxWidth: 720,
            }}
          >
            Every layer{" "}
            <span style={{ fontWeight: 600, color: TOKENS.layersMint }}>
              builds
            </span>{" "}
            on the last.
          </div>
        </div>
      </AbsoluteFill>

      {/* Rings */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="ly-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={TOKENS.layersMint} stopOpacity={0.5} />
            <stop offset="1" stopColor={TOKENS.layersMint} stopOpacity={0} />
          </radialGradient>
          <filter id="ly-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Halo + center dot */}
        <circle cx={cx} cy={cy} r={150} fill="url(#ly-halo)" filter="url(#ly-soft)" />
        <circle cx={cx} cy={cy} r={36} fill={TOKENS.layersMint} opacity={0.22} />
        <circle cx={cx} cy={cy} r={14} fill={TOKENS.layersMint} />

        {LAYERS.map((layer, i) => {
          const age = frame - layer.delay;
          if (age <= 0) return null;
          // Spring-ish growth toward final radius
          const grow = 1 - Math.exp(-age / 22);
          const radius = 30 + layer.baseR * grow;
          // Fade in then settle to a steady opacity
          const fadeIn = Math.min(1, age / 14);
          const settled = 0.32 + 0.22 * Math.exp(-age / 60);
          const opacity = settled * fadeIn;
          return (
            <g key={i}>
              <OrganicRing
                cx={cx}
                cy={cy}
                baseR={radius}
                amp={radius * 0.038}
                lobesA={3 + (i % 2)}
                lobesB={5 + (i % 3)}
                phase={phaseBase + i * 0.9}
                stroke={layer.color}
                strokeWidth={i === LAYERS.length - 1 ? 1.6 : 2.2}
                opacity={opacity}
              />
              {grow > 0.74 && (
                <text
                  x={cx + radius * 0.78}
                  y={cy - radius * 0.78 - 8}
                  fill={layer.color}
                  fontFamily={`"JetBrains Mono", "SF Mono", ui-monospace, monospace`}
                  fontSize={20}
                  opacity={Math.min(1, (grow - 0.74) * 4)}
                >
                  {layer.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
