import React from "react";
import { TOKENS, RADII } from "../lib/tokens";

/**
 * Paper Calm surface card. Used for every product UI mock so the chrome stays
 * consistent across scenes. Mirrors the surface treatment in landing.tsx
 * (subtle border, soft long shadow with a violet tint).
 */
export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  padding?: number | string;
  radius?: number;
  /** Adds a quiet warm halo behind the card — used for the "lights up" moment */
  glow?: number;
}> = ({ children, style, padding = 28, radius = RADII.xl, glow = 0 }) => {
  return (
    <div
      style={{
        position: "relative",
        background: TOKENS.bgSurface,
        border: `1px solid ${TOKENS.borderDefault}`,
        borderRadius: radius,
        padding,
        boxShadow: `0 30px 60px -34px color-mix(in oklch, ${TOKENS.layersViolet} ${
          22 + glow * 28
        }%, transparent), 0 6px 18px -10px rgba(20, 30, 50, 0.10)`,
        ...style,
      }}
    >
      {glow > 0.01 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -28,
            borderRadius: radius + 16,
            background: `radial-gradient(ellipse at 50% 50%, color-mix(in oklch, ${TOKENS.layersMintTint} ${
              60 * glow
            }%, transparent) 0%, transparent 65%)`,
            zIndex: -1,
            pointerEvents: "none",
          }}
        />
      )}
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: string;
  meta?: React.ReactNode;
  accent?: string;
}> = ({ title, meta, accent = TOKENS.layersMint }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: accent,
            boxShadow: `0 0 0 6px color-mix(in oklch, ${accent} 16%, transparent)`,
          }}
        />
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: TOKENS.ink,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </span>
      </div>
      {meta && (
        <span
          style={{
            fontSize: 14,
            color: TOKENS.fgMuted,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {meta}
        </span>
      )}
    </div>
  );
};
