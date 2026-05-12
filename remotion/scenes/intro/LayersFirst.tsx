import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  useVideoConfig,
  spring,
} from "remotion";
import { TOKENS, RADII, FONT_ITALIC_SERIF } from "../../lib/tokens";
import { AudioWave } from "../../components/AudioWave";

/**
 * Scene 03 (12-20s, 240f) — "Layers, first."
 *
 * The meeting-card from Islands grows to become the focal point of the frame
 * while the periphery cards retreat (handled by Islands' peripheryDim and by
 * this scene sitting on top of them in z-order).
 *
 * The card's interior comes alive: a mint dot + "Recording" eyebrow appear,
 * a quiet audio-wave ribbon stripes through the middle. Subtitle below the
 * card names the layer.
 */
export const LayersFirst: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // The meeting card grows from its Islands base (380×92) into a hero card.
  const grow = spring({
    frame,
    fps,
    config: { damping: 200, mass: 1.1 },
    durationInFrames: 50,
  });

  // Target hero size — a little wider than a half-frame, never bleeds the edges.
  const baseW = 380;
  const baseH = 92;
  const targetW = Math.min(1180, width * 0.62);
  const targetH = 360;

  const cardW = interpolate(grow, [0, 1], [baseW, targetW]);
  const cardH = interpolate(grow, [0, 1], [baseH, targetH]);

  // Subtitle lags the card growth so the eye reads the shape first.
  const subtitleFade = interpolate(frame, [40, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const subtitleLift = interpolate(frame, [40, 78], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Wave amplitude follows the same spring so it "breathes alive" with the
  // card opening.
  const waveLevel = 0.18 + grow * 0.32;

  // Soft mint halo behind the card — restraint: only appears at full growth.
  const halo = Math.max(0, (grow - 0.55) / 0.45);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <div
        style={{
          position: "relative",
          width: cardW,
          height: cardH,
        }}
      >
        {halo > 0.01 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -40,
              borderRadius: RADII.card + 20,
              background: `radial-gradient(ellipse at 50% 50%, color-mix(in oklch, ${TOKENS.layersMintTint} ${
                70 * halo
              }%, transparent) 0%, transparent 65%)`,
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
            border: `1px solid ${TOKENS.borderDefault}`,
            borderRadius: RADII.card,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            boxShadow: `0 36px 70px -36px color-mix(in oklch, ${TOKENS.layersViolet} ${
              22 + halo * 18
            }%, transparent), 0 8px 22px -12px rgba(20, 30, 50, 0.10)`,
          }}
        >
          {/* Card eyebrow — Recording state */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: TOKENS.layersMint,
                  boxShadow: `0 0 0 7px color-mix(in oklch, ${TOKENS.layersMint} 18%, transparent)`,
                  opacity: 0.4 + grow * 0.6,
                }}
              />
              <span
                style={{
                  fontSize: 16,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  color: TOKENS.fgMuted,
                }}
              >
                Recording
              </span>
            </div>
            <span
              style={{
                fontSize: 14,
                color: TOKENS.fgMuted,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: 600,
                opacity: grow,
              }}
            >
              9:24 AM
            </span>
          </div>

          {/* Card title */}
          <div
            style={{
              fontSize: interpolate(grow, [0, 1], [22, 40]),
              color: TOKENS.ink,
              fontWeight: 500,
              letterSpacing: "-0.012em",
              lineHeight: 1.18,
            }}
          >
            Pricing call
          </div>

          {/* Audio-wave ribbon — only appears once the card is big enough */}
          {grow > 0.4 && (
            <div
              style={{
                marginTop: "auto",
                opacity: (grow - 0.4) / 0.6,
              }}
            >
              <AudioWave
                width={Math.round(cardW - 64)}
                height={84}
                level={waveLevel}
                motion={0.85}
                minimal
              />
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          opacity: subtitleFade,
          transform: `translateY(${subtitleLift}px)`,
          fontSize: 30,
          color: TOKENS.fgMuted,
          letterSpacing: "-0.005em",
          textAlign: "center",
          fontWeight: 400,
          maxWidth: 1100,
          lineHeight: 1.4,
        }}
      >
        <em
          style={{
            fontFamily: FONT_ITALIC_SERIF,
            fontStyle: "italic",
            color: TOKENS.ink,
            fontWeight: 400,
          }}
        >
          Layers
        </em>{" "}
        — the meeting layer. The first chapter.
      </div>
    </AbsoluteFill>
  );
};
