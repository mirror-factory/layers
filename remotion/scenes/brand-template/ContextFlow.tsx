import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TOKENS } from "../../lib/tokens";
import { PaperBackground } from "../../components/PaperBackground";
import { ParticleField } from "./ParticleField";
import {
  ChatGptLogo,
  ClaudeLogo,
  CursorLogo,
  GeminiLogo,
} from "./vendor-logos";

/**
 * BEAT 5 — Context flows out (~8s).
 *
 * Layers mint dot at center, real vendor logos arranged around it. Organic
 * bezier curves connect the dot to each LLM, with a dashed mint overlay
 * flowing outward — context moving from the library into the tools where
 * the work actually happens.
 */

type Vendor = {
  name: string;
  x: number;
  y: number;
  delay: number;
  Logo: React.FC<{ size?: number }>;
};

const VENDORS: Vendor[] = [
  { name: "Claude", x: 0.18, y: 0.3, delay: 12, Logo: ClaudeLogo },
  { name: "ChatGPT", x: 0.82, y: 0.3, delay: 28, Logo: ChatGptLogo },
  { name: "Gemini", x: 0.18, y: 0.72, delay: 44, Logo: GeminiLogo },
  { name: "Cursor", x: 0.82, y: 0.72, delay: 60, Logo: CursorLogo },
];

export const ContextFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const seconds = frame / fps;

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

  // Caption
  const captionEnter = interpolate(frame, [4, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Center breathing rings
  const ringR1 = 56 + 3 * Math.sin(seconds * 1.1);
  const ringR2 = 34 + 2 * Math.sin(seconds * 1.4 + 1.2);

  return (
    <AbsoluteFill style={{ opacity: Math.min(enter, out) }}>
      <PaperBackground />
      {/* Quiet particle field — fills the space between center dot and the
       * vendor cards so the flow curves don't feel lonely.
       */}
      <ParticleField
        count={1100}
        cx={cx}
        cy={cy}
        rMin={140}
        rMax={Math.min(width, height) * 0.48}
        alpha={0.4}
        enterFrames={18}
        seedOffset={1}
      />

      <AbsoluteFill
        style={{
          padding: 110,
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <div style={{ textAlign: "center", opacity: captionEnter }}>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: TOKENS.fgFaint,
              marginBottom: 10,
            }}
          >
            04 — Context flows out
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: TOKENS.ink,
              maxWidth: 1100,
            }}
          >
            Your context, in every{" "}
            <span style={{ fontWeight: 600, color: TOKENS.layersMint }}>
              AI tool you use.
            </span>
          </div>
        </div>
      </AbsoluteFill>

      {/* SVG canvas — full screen */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="cf-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={TOKENS.layersMint} stopOpacity={0.5} />
            <stop offset="1" stopColor={TOKENS.layersMint} stopOpacity={0} />
          </radialGradient>
          <filter id="cf-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        {/* Flow paths */}
        {VENDORS.map((v, i) => {
          const vx = width * v.x;
          const vy = height * v.y;
          const age = frame - v.delay;
          if (age <= 0) return null;
          const enterCurve = Math.min(1, age / 28);

          // Midpoint with sine-driven perturbation so the curves breathe
          const mx = (cx + vx) / 2 + Math.sin(seconds * 0.9 + i * 1.7) * 36;
          const my = (cy + vy) / 2 + Math.cos(seconds * 1.1 + i * 1.7) * 42;

          // Curve grows outward from the dot — we use a path with a clip via stroke-dash.
          const d = `M ${cx} ${cy} Q ${mx} ${my} ${vx} ${vy}`;
          // Roughly approximate path length for the dash; cheaper than getTotalLength.
          const approxLen = Math.hypot(vx - cx, vy - cy) * 1.18;
          const dashOffset = approxLen * (1 - enterCurve);

          return (
            <g key={v.name}>
              {/* Soft halo behind line */}
              <path
                d={d}
                fill="none"
                stroke="rgba(99, 102, 241, 0.22)"
                strokeWidth={20}
                strokeLinecap="round"
                strokeDasharray={approxLen}
                strokeDashoffset={dashOffset}
                filter="url(#cf-soft)"
              />
              {/* Primary indigo line */}
              <path
                d={d}
                fill="none"
                stroke="rgba(99, 102, 241, 0.92)"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeDasharray={approxLen}
                strokeDashoffset={dashOffset}
              />
              {/* Dashed mint overlay flowing toward the vendor */}
              <path
                d={d}
                fill="none"
                stroke={TOKENS.layersMint}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeDasharray="6 12"
                strokeDashoffset={-seconds * 36}
                opacity={0.85 * enterCurve}
              />
            </g>
          );
        })}

        {/* Center: halo + rings + dot */}
        <circle
          cx={cx}
          cy={cy}
          r={130}
          fill="url(#cf-halo)"
          filter="url(#cf-soft)"
        />
        <circle
          cx={cx}
          cy={cy}
          r={ringR1}
          fill="none"
          stroke={TOKENS.layersBlue}
          strokeWidth={2.4}
          opacity={0.55}
        />
        <circle
          cx={cx}
          cy={cy}
          r={ringR2}
          fill="none"
          stroke={TOKENS.layersViolet}
          strokeWidth={2.4}
          opacity={0.75}
        />
        <circle
          cx={cx}
          cy={cy}
          r={36}
          fill={TOKENS.layersMint}
          opacity={0.22}
        />
        <circle cx={cx} cy={cy} r={18} fill={TOKENS.layersMint} />
      </svg>

      {/* Vendor cards — one per quadrant */}
      {VENDORS.map((v) => {
        const vx = width * v.x;
        const vy = height * v.y;
        const age = frame - v.delay;
        if (age <= 0) return null;
        const cardEnter = Math.min(1, age / 22);
        return (
          <div
            key={v.name}
            style={{
              position: "absolute",
              left: vx - 64,
              top: vy - 64,
              width: 128,
              height: 128,
              opacity: cardEnter,
              transform: `scale(${0.85 + cardEnter * 0.15})`,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background: TOKENS.bgSurface,
                border: `1px solid ${TOKENS.borderDefault}`,
                borderRadius: 24,
                boxShadow: "0 26px 60px -32px oklch(0.2 0.04 240 / 0.42)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <v.Logo size={72} />
            </div>
            <div
              style={{
                marginTop: 10,
                textAlign: "center",
                fontFamily: `"JetBrains Mono", "SF Mono", ui-monospace, monospace`,
                fontSize: 14,
                color: TOKENS.fgMuted,
              }}
            >
              {v.name}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
