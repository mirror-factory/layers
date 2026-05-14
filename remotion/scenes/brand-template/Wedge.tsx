import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TOKENS } from "../../lib/tokens";
import { PaperBackground } from "../../components/PaperBackground";
import { AudioWave } from "../../components/AudioWave";

/**
 * BEAT 2 — The wedge: audio intake (~8s).
 *
 * A phone-style card on the right with the live ribbon and a transcript
 * filling in. A caption on the left names the moment: "Tap once. Capture
 * the moment." Voice anchor for this beat: the audio recorder you actually
 * see in the app's record/live page.
 */

const TRANSCRIPT_LINES = [
  "Pricing tier review — Q4.",
  "We're holding the current tiers.",
  "Sara is going to track the customer concern from the Onboarding kickoff —",
  "Layers will route it the next time a pricing question hits Claude.",
];

export const Wedge: React.FC = () => {
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

  // Caption beats
  const captionEnter = interpolate(frame, [10, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionAccentEnter = interpolate(frame, [44, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phone-tap pulse — three quick pulses then settled recording
  const tapStart = 26;
  const tapPulses = [tapStart, tapStart + 14, tapStart + 28];
  const tapOpacity = tapPulses
    .map((t) => Math.max(0, 1 - Math.abs(frame - t) / 7))
    .reduce((a, b) => Math.max(a, b), 0);

  // Audio level — peaks during talk windows
  const seconds = frame / fps;
  const recordingActive = frame >= tapStart + 28;
  const baseLvl = recordingActive ? 0.4 : 0.08;
  const level =
    baseLvl +
    (recordingActive
      ? 0.25 * (0.5 + 0.5 * Math.sin(seconds * 6))
      : 0);

  // Transcript reveals — one line at a time, each fading in
  const transcriptBase = tapStart + 36;
  const transcriptStride = 28;

  return (
    <AbsoluteFill style={{ opacity: Math.min(enter, out) }}>
      <PaperBackground />

      {/* Left: caption */}
      <AbsoluteFill style={{ padding: 110, alignItems: "flex-start", justifyContent: "center" }}>
        <div style={{ maxWidth: 760 }}>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: TOKENS.fgFaint,
              opacity: captionEnter,
              marginBottom: 14,
            }}
          >
            01 — The wedge
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.04,
              color: TOKENS.ink,
              opacity: captionEnter,
              transform: `translateY(${(1 - captionEnter) * 16}px)`,
            }}
          >
            Tap once.
            <br />
            <span
              style={{
                fontWeight: 600,
                color: TOKENS.layersMint,
                opacity: captionAccentEnter,
              }}
            >
              Capture the moment.
            </span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 24,
              color: TOKENS.fgMuted,
              maxWidth: 540,
              opacity: captionAccentEnter,
              lineHeight: 1.45,
            }}
          >
            Audio intake is the wedge. Phone tap at a Starbucks counter, in a Zoom, in a Slack huddle. Layers transcribes, structures, and layers it.
          </div>
        </div>
      </AbsoluteFill>

      {/* Right: phone card */}
      <AbsoluteFill
        style={{
          padding: 110,
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <PhoneCard
          width={520}
          height={830}
          level={level}
          recordingActive={recordingActive}
          tapOpacity={tapOpacity}
          transcriptBase={transcriptBase}
          transcriptStride={transcriptStride}
          frame={frame}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const PhoneCard: React.FC<{
  width: number;
  height: number;
  level: number;
  recordingActive: boolean;
  tapOpacity: number;
  transcriptBase: number;
  transcriptStride: number;
  frame: number;
}> = ({ width, height, level, recordingActive, tapOpacity, transcriptBase, transcriptStride, frame }) => {
  return (
    <div
      style={{
        width,
        height,
        background: TOKENS.bgSurface,
        border: `1px solid ${TOKENS.borderDefault}`,
        borderRadius: 44,
        boxShadow: "0 60px 120px -60px oklch(0.2 0.04 240 / 0.5)",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Status bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: `"JetBrains Mono", "SF Mono", ui-monospace, monospace`,
          fontSize: 14,
          color: TOKENS.fgMuted,
        }}
      >
        <span>9:41</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: recordingActive ? TOKENS.danger : TOKENS.fgFaint,
            }}
          />
          {recordingActive ? "REC" : "READY"}
        </span>
      </div>

      {/* Wave */}
      <div
        style={{
          height: 180,
          background: TOKENS.bgSurfaceMuted,
          borderRadius: 28,
          border: `1px solid ${TOKENS.borderSubtle}`,
          padding: 16,
          display: "flex",
          alignItems: "center",
        }}
      >
        <AudioWave width={width - 80} height={140} level={level} motion={recordingActive ? 1.1 : 0.5} />
      </div>

      {/* Transcript card */}
      <div
        style={{
          flex: 1,
          background: TOKENS.bgPage,
          border: `1px solid ${TOKENS.borderSubtle}`,
          borderRadius: 28,
          padding: 24,
          fontSize: 21,
          fontWeight: 500,
          lineHeight: 1.45,
          letterSpacing: "-0.01em",
          color: TOKENS.ink,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ fontFamily: `"JetBrains Mono", ui-monospace, monospace`, fontSize: 11, color: TOKENS.fgMuted, letterSpacing: "0.12em" }}>
          TRANSCRIPT · LIVE
        </div>
        {TRANSCRIPT_LINES.map((line, i) => {
          const start = transcriptBase + i * transcriptStride;
          const opacity = interpolate(frame, [start, start + 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const y = interpolate(frame, [start, start + 26], [10, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div key={i} style={{ opacity, transform: `translateY(${y}px)` }}>
              {line}
            </div>
          );
        })}
      </div>

      {/* Tap target */}
      <div
        style={{
          alignSelf: "center",
          marginTop: 8,
          width: 116,
          height: 116,
          borderRadius: 999,
          background: recordingActive ? TOKENS.danger : TOKENS.ink,
          color: TOKENS.bgPage,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.16em",
          position: "relative",
        }}
      >
        {recordingActive ? "STOP" : "TAP"}
        {/* Tap pulse rings */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            border: `2px solid ${TOKENS.layersMint}`,
            opacity: tapOpacity,
            transform: `scale(${1 + tapOpacity * 0.8})`,
          }}
        />
      </div>
    </div>
  );
};
