import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TOKENS } from "../lib/tokens";
import { AudioWave } from "../components/AudioWave";
import { Card, CardHeader } from "../components/Card";
import { LayersMark } from "../components/LayersMark";

/**
 * Scene 01 (6-22s) — Recording in progress.
 *
 * The recording workspace card sits center-left with a live audio wave; live
 * transcript turns drop in on the right side, one at a time, on the same
 * cadence the real product uses (~3 second cycle). Mirrors HeroComposition
 * in app/(public)/landing.tsx as closely as possible without being a 1:1
 * screenshot — keeps the brand chrome consistent.
 */

const TRANSCRIPT_TURNS: ReadonlyArray<{
  time: string;
  speaker: string;
  text: string;
}> = [
  { time: "00:11", speaker: "Jamie", text: "Let's commit to shipping onboarding first." },
  { time: "00:14", speaker: "Owen", text: "Agreed — I'll own the first-run copy by Friday." },
  { time: "00:18", speaker: "Jamie", text: "Decision: launch staging next week." },
  { time: "00:22", speaker: "Sara", text: "Pricing tier stays unchanged for now." },
];

const TURN_INTERVAL = 30 * 2.4; // ~2.4s between turn drops

export const Record: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Quick fade-in. We map a virtual window starting before frame 0 so the very
  // first rendered frame of the scene is already visible (~50% opaque), which
  // prevents a blank hole at the scene boundary. Pure spring from 0 leaves a
  // hole because spring(0) = 0.
  const enter = interpolate(frame, [-6, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The wave reads "loud" while recording — but never overdriven.
  const recordingLevel = 0.55 + 0.12 * Math.sin(frame / 8);
  const recordingPulse = 0.5 + 0.5 * Math.sin(frame / 14);

  return (
    <AbsoluteFill
      style={{
        opacity: enter,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 56,
          width: "100%",
          maxWidth: 1620,
          alignItems: "center",
        }}
      >
        {/* Left: Recording workspace */}
        <Card padding={32}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <LayersMark size={32} />
              <span
                style={{
                  fontSize: 16,
                  color: TOKENS.fgMuted,
                  letterSpacing: "0.04em",
                }}
              >
                Recording workspace
              </span>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: TOKENS.danger,
                padding: "6px 14px",
                borderRadius: 999,
                background: `color-mix(in oklch, ${TOKENS.danger} 9%, transparent)`,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: TOKENS.danger,
                  opacity: 0.5 + 0.5 * recordingPulse,
                }}
              />
              {formatTimer(frame, fps)} LIVE
            </span>
          </div>

          <div
            style={{
              borderRadius: 16,
              padding: 12,
              background: `linear-gradient(180deg, color-mix(in oklch, ${TOKENS.layersMintTint} 50%, ${TOKENS.bgPage}) 0%, ${TOKENS.bgSurface} 100%)`,
              border: `1px solid ${TOKENS.borderSubtle}`,
              overflow: "hidden",
            }}
          >
            <AudioWave width={680} height={150} level={recordingLevel} motion={1.05} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 14,
              marginTop: 26,
              paddingTop: 22,
              borderTop: `1px solid ${TOKENS.borderSubtle}`,
            }}
          >
            {[
              ["Decisions", "2"],
              ["Actions", "3"],
              ["Intake", "3"],
              ["Follow-up", "2"],
            ].map(([label, count]) => (
              <div key={label} style={{ display: "grid", gap: 4 }}>
                <span
                  style={{
                    fontSize: 30,
                    lineHeight: 1,
                    color: TOKENS.ink,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {count}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: TOKENS.fgMuted,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Right: Live transcript feed — turns scroll in */}
        <Card padding={26}>
          <CardHeader
            title="Live transcript"
            meta="streaming"
            accent={TOKENS.layersMint}
          />
          <div style={{ display: "grid", gap: 14, minHeight: 320 }}>
            {TRANSCRIPT_TURNS.map((turn, i) => (
              <TranscriptTurn
                key={i}
                turn={turn}
                appearAt={i * TURN_INTERVAL + 18}
              />
            ))}
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

const TranscriptTurn: React.FC<{
  turn: { time: string; speaker: string; text: string };
  appearAt: number;
}> = ({ turn, appearAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const local = frame - appearAt;
  const enter = spring({
    frame: local,
    fps,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translate = interpolate(enter, [0, 1], [10, 0]);

  if (local < 0) {
    return (
      <div
        style={{
          height: 64,
          background: "transparent",
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        opacity,
        transform: `translateY(${translate}px)`,
        padding: "12px 14px",
        borderRadius: 12,
        background: `color-mix(in oklch, ${TOKENS.layersMintTint} 32%, transparent)`,
        border: `1px solid ${TOKENS.borderSubtle}`,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: TOKENS.fgFaint,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.04em",
          minWidth: 56,
          paddingTop: 2,
        }}
      >
        {turn.time}
      </span>
      <div style={{ display: "grid", gap: 4, flex: 1 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: TOKENS.layersViolet,
            letterSpacing: "0.005em",
          }}
        >
          {turn.speaker}
        </span>
        <span
          style={{
            fontSize: 19,
            color: TOKENS.ink,
            lineHeight: 1.4,
          }}
        >
          {turn.text}
        </span>
      </div>
    </div>
  );
};

function formatTimer(frame: number, fps: number): string {
  const totalSeconds = 11 + Math.floor(frame / fps);
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
