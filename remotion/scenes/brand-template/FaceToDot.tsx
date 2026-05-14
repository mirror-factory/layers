import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TOKENS } from "../../lib/tokens";
import { PaperBackground } from "../../components/PaperBackground";

/**
 * BEAT 3 — Pan from face to dot (~6s).
 *
 * Camera pulls up from a head-on silhouette. From above, the head is just a
 * single mint dot. The brand thesis is here: you are the constant across
 * every tool you use, and from a distance you are a single point at the
 * center of a context library.
 */

export const FaceToDot: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = interpolate(frame, [148, 180], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pan progress 0→1 over the central portion of the beat.
  const pan = interpolate(frame, [30, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Ease-out cubic
  const ease = 1 - Math.pow(1 - pan, 3);

  const cx = width * 0.5;
  // Camera moves up: face Y begins ~62% (lower body in frame), ends ~50% (top-down dot)
  const cy = height * (0.62 - 0.12 * ease);
  // Dot radius shrinks dramatically
  const dotR = interpolate(ease, [0, 1], [128, 9]);
  // Halo grows
  const haloR = interpolate(ease, [0, 1], [180, 70]);
  // Silhouette/shoulders fade away
  const shoulderOpacity = (1 - ease) * 0.65;

  // Caption
  const captionEnter = interpolate(frame, [120, 156], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: Math.min(enter, out) }}>
      <PaperBackground />

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="ft-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={TOKENS.layersMint} stopOpacity={0.45} />
            <stop offset="1" stopColor={TOKENS.layersMint} stopOpacity={0} />
          </radialGradient>
          <filter id="ft-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* Shoulders — fades away as the camera pulls up */}
        <ellipse
          cx={cx}
          cy={cy + 240 - ease * 80}
          rx={420 * (1 - ease * 0.55)}
          ry={140 * (1 - ease * 0.6)}
          fill={TOKENS.ink}
          opacity={shoulderOpacity}
          filter="url(#ft-soft)"
        />

        {/* Halo */}
        <circle cx={cx} cy={cy} r={haloR} fill="url(#ft-halo)" />

        {/* The dot (you) */}
        <circle cx={cx} cy={cy} r={dotR} fill={TOKENS.layersMint} opacity={0.94} />

        {/* Subtle thin breath ring once we're fully overhead */}
        {ease > 0.85 && (
          <circle
            cx={cx}
            cy={cy}
            r={dotR + 10 + Math.sin(frame * 0.18) * 3}
            fill="none"
            stroke={TOKENS.layersMint}
            strokeWidth={1.2}
            opacity={0.55 * (ease - 0.85) / 0.15}
          />
        )}
      </svg>

      {/* Caption — appears once we're overhead */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 110,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            opacity: captionEnter,
            transform: `translateY(${(1 - captionEnter) * 12}px)`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: TOKENS.fgFaint,
              marginBottom: 10,
            }}
          >
            02 — You are the dot
          </div>
          <div
            style={{
              fontSize: 60,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: TOKENS.ink,
            }}
          >
            The constant across every tool —{" "}
            <span
              style={{
                fontWeight: 600,
                color: TOKENS.layersMint,
              }}
            >
              you.
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
