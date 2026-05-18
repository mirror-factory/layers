import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  useVideoConfig,
} from "remotion";
import { TOKENS, RADII } from "../../lib/tokens";

/**
 * Scene 02 (4-12s, 240f at 30fps) — "Context islands."
 *
 * A constellation of small context cards appearing one by one. Each is
 * labelled by *moment* (not feature). 5 islands total, staggered so the eye
 * has time to read each before the next arrives. The meeting card sits dead-
 * centre so the next scene (LayersFirst) has somewhere to grow from.
 *
 * Geometry is in normalized 0-1 space → multiplied by composition width/height
 * so a single layout works at any frame size.
 */

type Island = {
  /** Centre point in normalized 0-1 coordinates. (0.5, 0.5) = frame centre */
  x: number;
  y: number;
  /** Frame at which this island starts fading in */
  enterAt: number;
  /** Type label — small uppercase eyebrow */
  kind: string;
  /** Headline — the actual moment */
  label: string;
  /** Accent dot uses mint everywhere; the meeting card uses ink so the
   *  upcoming hand-off to scene 3 feels intentional. */
  meeting?: boolean;
};

const ISLANDS: Island[] = [
  {
    x: 0.5,
    y: 0.5,
    enterAt: 18,
    kind: "Meeting",
    label: "9:24 — pricing call",
    meeting: true,
  },
  {
    x: 0.22,
    y: 0.32,
    enterAt: 48,
    kind: "Interview",
    label: "Tuesday — interview",
  },
  {
    x: 0.78,
    y: 0.34,
    enterAt: 80,
    kind: "Conversation",
    label: "lunch with Sam — pricing concern",
  },
  {
    x: 0.25,
    y: 0.72,
    enterAt: 110,
    kind: "Routine",
    label: "morning routine",
  },
  {
    x: 0.76,
    y: 0.74,
    enterAt: 140,
    kind: "Note",
    label: "desk — re-read Q3 plan",
  },
];

export const Islands: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Cards' base widths — keep them small enough that the centre meeting card
  // has room to scale on its own line and so the periphery never crowds.
  const CARD_W = 380;
  const CARD_H = 92;

  // Scene-wide fade-out used by LayersFirst handoff isn't owned here; Remotion
  // <Sequence> handles unmount. We do soften the periphery once the meeting
  // card has finished entering so the eye is drawn to centre.
  const peripheryDim = interpolate(frame, [200, 240], [1, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {ISLANDS.map((island, idx) => {
        const local = frame - island.enterAt;
        const fade = interpolate(local, [0, 36], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.quad),
        });
        const lift = interpolate(local, [0, 36], [10, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.quad),
        });

        const dim = island.meeting ? 1 : peripheryDim;
        const left = island.x * width - CARD_W / 2;
        const top = island.y * height - CARD_H / 2;

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left,
              top,
              width: CARD_W,
              height: CARD_H,
              opacity: fade * dim,
              transform: `translateY(${lift}px)`,
              background: TOKENS.bgSurface,
              border: `1px solid ${TOKENS.borderDefault}`,
              borderRadius: RADII.lg,
              padding: "18px 22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
              boxShadow: `0 18px 32px -22px color-mix(in oklch, ${TOKENS.layersViolet} 22%, transparent), 0 4px 12px -8px rgba(20, 30, 50, 0.06)`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: island.meeting ? TOKENS.layersMint : TOKENS.fgFaint,
                  boxShadow: island.meeting
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
                  color: TOKENS.fgMuted,
                }}
              >
                {island.kind}
              </span>
            </div>
            <div
              style={{
                fontSize: 22,
                color: TOKENS.ink,
                fontWeight: 500,
                letterSpacing: "-0.005em",
              }}
            >
              {island.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
