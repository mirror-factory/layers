import React from "react";
import { useCurrentFrame, interpolate, Sequence } from "remotion";
import { TOKENS } from "../lib/tokens";

/**
 * Caption track. Per PROD-388 acceptance criteria, captions must be present
 * for the whole video. We render them as a single bottom strip — restrained,
 * paper-tone, no purple AI-sparkle box.
 */

export type CaptionItem = {
  /** Frame to fade in (absolute frame on the master timeline) */
  from: number;
  /** Duration in frames */
  duration: number;
  text: string;
};

export const CAPTIONS: ReadonlyArray<CaptionItem> = [
  // 00 cold-open (0-6s)
  { from: 30 * 0.5, duration: 30 * 5, text: "AI memory for your meetings." },
  // 01 record (6-22s)
  { from: 30 * 6, duration: 30 * 4, text: "Hit record. Layers listens." },
  { from: 30 * 10, duration: 30 * 5, text: "Every word transcribed in real time." },
  { from: 30 * 15.2, duration: 30 * 6.6, text: "Speaker turns, timestamps, decisions — captured for you." },
  // 02 memory (22-40s)
  { from: 30 * 22, duration: 30 * 5, text: "When the meeting ends, the memory begins." },
  { from: 30 * 27.2, duration: 30 * 5.6, text: "Summary, decisions, and action items, ready to share." },
  { from: 30 * 33, duration: 30 * 6.9, text: "No more “what did we agree on?”" },
  // 03 search (40-58s)
  { from: 30 * 40, duration: 30 * 5, text: "Search across every meeting you’ve had." },
  { from: 30 * 45.2, duration: 30 * 5.8, text: "Find the moment a decision was made." },
  { from: 30 * 51.2, duration: 30 * 6.6, text: "Your memory, indexed and instant." },
  // 04 mcp (58-78s)
  { from: 30 * 58, duration: 30 * 5, text: "Plug Layers into Claude, ChatGPT, anywhere." },
  { from: 30 * 63.2, duration: 30 * 7, text: "layers.search(“pricing decisions”) returns structured JSON." },
  { from: 30 * 70.4, duration: 30 * 7.4, text: "Your meeting memory, in every AI tool you use." },
  // 05 cta (78-85s)
  { from: 30 * 78, duration: 30 * 7, text: "Currently in invite-only alpha. Email support@mirrorfactory.ai for access." },
];

const CaptionLine: React.FC<{ text: string; duration: number }> = ({
  text,
  duration,
}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity,
          background: "rgba(255, 255, 255, 0.86)",
          backdropFilter: "blur(10px)",
          border: `1px solid ${TOKENS.borderSubtle}`,
          color: TOKENS.ink,
          padding: "14px 26px",
          borderRadius: 999,
          fontSize: 30,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          boxShadow: "0 10px 30px -16px rgba(20, 40, 60, 0.18)",
          maxWidth: 1280,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const CaptionTrack: React.FC = () => {
  return (
    <>
      {CAPTIONS.map((cap, i) => (
        <Sequence
          key={`cap-${i}`}
          from={cap.from}
          durationInFrames={cap.duration}
          layout="none"
        >
          <CaptionLine text={cap.text} duration={cap.duration} />
        </Sequence>
      ))}
    </>
  );
};
