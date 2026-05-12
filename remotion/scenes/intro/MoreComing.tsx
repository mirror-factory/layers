import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  useVideoConfig,
} from "remotion";
import { TOKENS, RADII, FONT_ITALIC_SERIF } from "../../lib/tokens";

/**
 * Scene 04 (20-28s, 240f) — "More coming."
 *
 * The meeting card shrinks back to a peer-sized tile. Four periphery cards
 * return with a soft mint glow — these are the other Mirror Factory layers
 * waiting in the wings (calendar, email, conversations, desk). They're
 * labelled as types this time (not moments) so the audience reads "more
 * surfaces" rather than "more events".
 *
 * Subtitle: "More coming."
 */

type Tile = {
  x: number;
  y: number;
  delay: number;
  kind: string;
  label: string;
  current?: boolean;
};

const TILES: Tile[] = [
  // Centre — the now-quiet meeting card, identical position to Islands so the
  // continuity reads.
  {
    x: 0.5,
    y: 0.5,
    delay: 0,
    kind: "Meeting",
    label: "Layers",
    current: true,
  },
  { x: 0.22, y: 0.32, delay: 18, kind: "Calendar", label: "your week" },
  { x: 0.78, y: 0.34, delay: 38, kind: "Email", label: "what's in your inbox" },
  { x: 0.25, y: 0.72, delay: 58, kind: "Conversations", label: "what you said" },
  { x: 0.76, y: 0.74, delay: 78, kind: "Desk", label: "what you wrote" },
];

export const MoreComing: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const CARD_W = 380;
  const CARD_H = 92;

  // Subtitle "More coming." lands once all four periphery cards have begun
  // entering.
  const subtitleFade = interpolate(frame, [110, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const subtitleLift = interpolate(frame, [110, 150], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill>
      {TILES.map((tile, idx) => {
        const local = frame - tile.delay;
        // Centre card is continuous from LayersFirst — it must be visible at
        // frame 0 of this scene with no fade-in (otherwise the handoff flashes
        // a blank frame between scenes).
        const fade = tile.current
          ? 1
          : interpolate(local, [0, 36], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            });
        const lift = tile.current
          ? 0
          : interpolate(local, [0, 36], [10, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            });

        // Periphery cards breathe a quiet mint halo so they read as future-
        // tense without being loud. Pulse is frame-deterministic so renders
        // are reproducible.
        const breath = tile.current
          ? 0
          : 0.5 + 0.5 * Math.sin((frame - tile.delay) * 0.04);
        const glow = tile.current ? 0 : 0.35 + 0.25 * breath;

        const left = tile.x * width - CARD_W / 2;
        const top = tile.y * height - CARD_H / 2;

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left,
              top,
              width: CARD_W,
              height: CARD_H,
              opacity: fade,
              transform: `translateY(${lift}px)`,
            }}
          >
            {glow > 0.01 && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: -22,
                  borderRadius: RADII.lg + 12,
                  background: `radial-gradient(ellipse at 50% 50%, color-mix(in oklch, ${TOKENS.layersMintTint} ${
                    55 * glow
                  }%, transparent) 0%, transparent 68%)`,
                  zIndex: -1,
                  pointerEvents: "none",
                }}
              />
            )}
            <div
              style={{
                width: "100%",
                height: "100%",
                background: TOKENS.bgSurface,
                border: `1px solid ${
                  tile.current
                    ? TOKENS.borderDefault
                    : `color-mix(in oklch, ${TOKENS.layersMint} 36%, ${TOKENS.borderSubtle})`
                }`,
                borderRadius: RADII.lg,
                padding: "18px 22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 6,
                boxShadow: `0 18px 32px -22px color-mix(in oklch, ${TOKENS.layersViolet} 22%, transparent), 0 4px 12px -8px rgba(20, 30, 50, 0.06)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: tile.current ? TOKENS.layersMint : TOKENS.fgFaint,
                    boxShadow: tile.current
                      ? `0 0 0 5px color-mix(in oklch, ${TOKENS.layersMint} 18%, transparent)`
                      : "none",
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    color: tile.current ? TOKENS.fgMuted : TOKENS.fgFaint,
                  }}
                >
                  {tile.kind}
                </span>
              </div>
              <div
                style={{
                  fontSize: 22,
                  color: tile.current ? TOKENS.ink : TOKENS.fgMuted,
                  fontWeight: 500,
                  letterSpacing: "-0.005em",
                  fontStyle: tile.current ? "normal" : "italic",
                  fontFamily: tile.current ? undefined : FONT_ITALIC_SERIF,
                }}
              >
                {tile.label}
              </div>
            </div>
          </div>
        );
      })}

      {/* Subtitle — placed below the lower row of cards */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 88,
          textAlign: "center",
          opacity: subtitleFade,
          transform: `translateY(${subtitleLift}px)`,
        }}
      >
        <span
          style={{
            fontSize: 34,
            color: TOKENS.ink,
            letterSpacing: "-0.012em",
            fontWeight: 400,
            fontFamily: FONT_ITALIC_SERIF,
            fontStyle: "italic",
          }}
        >
          More coming.
        </span>
      </div>
    </AbsoluteFill>
  );
};
