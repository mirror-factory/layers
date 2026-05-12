import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { TOKENS, FONT_ITALIC_SERIF } from "../lib/tokens";
import { Card } from "../components/Card";
import { LayersMark } from "../components/LayersMark";

/**
 * Scene 04 (58-78s) — MCP integration.
 *
 * Mimics a Claude / ChatGPT chat. User asks a question, the assistant calls
 * `layers.search("pricing decisions")` as a tool, and the structured JSON
 * result expands in-frame. We render the call/result with the same tool-card
 * chrome a real client would show.
 */

const USER_MESSAGE = "What did we decide about pricing in the last few weeks?";
const ASSISTANT_PREAMBLE =
  "Let me check your meeting memory for any pricing-related decisions.";

const TOOL_CALL = `layers.search({ query: "pricing decisions", since: "30d" })`;

const TOOL_RESULT = `{
  "results": [
    {
      "meeting": "Pricing tier review",
      "date": "2026-05-09",
      "decision": "Hold current tiers. Revisit after onboarding data lands."
    },
    {
      "meeting": "Onboarding kickoff",
      "date": "2026-05-12",
      "decision": "Pricing stays unchanged for this cycle."
    }
  ]
}`;

const ASSISTANT_SUMMARY =
  "Pricing has been held steady the past two weeks — the team agreed to revisit after onboarding data lands. Sara is tracking a customer concern raised in the Onboarding kickoff.";

export const Mcp: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [-6, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Stage timing (frames are local to this scene; scene is 20s = 600 frames)
  // Starts from frame -6 so the user message already reads at the boundary.
  const userOpacity = clampFade(frame, -6, 14);
  const preambleOpacity = clampFade(frame, 60, 18);
  const toolCallOpacity = clampFade(frame, 120, 18);

  // Tool call "thinks" with a spinner for ~30 frames before the result lands.
  const spinnerActive = frame >= 150 && frame < 200;
  const toolResultOpacity = clampFade(frame, 200, 24);
  const toolResultHeight = interpolate(frame, [200, 230], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const summaryOpacity = clampFade(frame, 360, 24);

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
          width: "100%",
          maxWidth: 1240,
          display: "grid",
          gap: 22,
        }}
      >
        {/* Chat window chrome */}
        <Card padding={0} radius={20}>
          <ChatHeader />
          <div
            style={{
              padding: "28px 32px 32px",
              display: "grid",
              gap: 22,
            }}
          >
            {/* User message */}
            <div style={{ opacity: userOpacity }}>
              <ChatBubble role="user">{USER_MESSAGE}</ChatBubble>
            </div>

            {/* Assistant preamble */}
            <div style={{ opacity: preambleOpacity }}>
              <ChatBubble role="assistant">{ASSISTANT_PREAMBLE}</ChatBubble>
            </div>

            {/* Tool call card */}
            <div style={{ opacity: toolCallOpacity }}>
              <ToolCallCard
                spinnerActive={spinnerActive}
                resultOpacity={toolResultOpacity}
                resultProgress={toolResultHeight}
              />
            </div>

            {/* Assistant summary */}
            <div style={{ opacity: summaryOpacity }}>
              <ChatBubble role="assistant">{ASSISTANT_SUMMARY}</ChatBubble>
            </div>
          </div>
        </Card>

        {/* Subtitle */}
        <div
          style={{
            textAlign: "center",
            opacity: clampFade(frame, 420, 24),
            fontSize: 28,
            color: TOKENS.ink,
            letterSpacing: "-0.01em",
            fontWeight: 500,
          }}
        >
          Your meeting memory{" "}
          <em
            style={{
              fontFamily: FONT_ITALIC_SERIF,
              fontStyle: "italic",
              fontWeight: 400,
              color: TOKENS.layersMint,
            }}
          >
            in every AI tool.
          </em>
        </div>
      </div>
    </AbsoluteFill>
  );
};

function clampFade(frame: number, start: number, fadeFrames: number): number {
  return interpolate(frame, [start, start + fadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

const ChatHeader: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "18px 28px",
      borderBottom: `1px solid ${TOKENS.borderSubtle}`,
      background: TOKENS.bgSurfaceMuted,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    }}
  >
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        background: "rgba(20, 30, 50, 0.18)",
      }}
    />
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        background: "rgba(20, 30, 50, 0.18)",
      }}
    />
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        background: "rgba(20, 30, 50, 0.18)",
      }}
    />
    <span
      style={{
        marginLeft: 16,
        fontSize: 14,
        fontWeight: 600,
        color: TOKENS.fgMuted,
        letterSpacing: "0.04em",
      }}
    >
      Claude · with Layers MCP
    </span>
  </div>
);

const ChatBubble: React.FC<{ role: "user" | "assistant"; children: React.ReactNode }> = ({
  role,
  children,
}) => {
  if (role === "user") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            maxWidth: 760,
            padding: "16px 22px",
            background: `color-mix(in oklch, ${TOKENS.layersMintTint} 65%, ${TOKENS.bgSurface} 35%)`,
            color: TOKENS.ink,
            borderRadius: 18,
            fontSize: 19,
            lineHeight: 1.5,
            letterSpacing: "-0.005em",
          }}
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: 999,
          background: TOKENS.bgPage,
          border: `1px solid ${TOKENS.borderSubtle}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LayersMark size={20} />
      </div>
      <div
        style={{
          flex: 1,
          fontSize: 19,
          lineHeight: 1.55,
          color: TOKENS.ink,
          letterSpacing: "-0.005em",
          maxWidth: 760,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const ToolCallCard: React.FC<{
  spinnerActive: boolean;
  resultOpacity: number;
  resultProgress: number;
}> = ({ spinnerActive, resultOpacity, resultProgress }) => {
  const frame = useCurrentFrame();
  // Subtle spinner rotation
  const rot = (frame * 6) % 360;

  return (
    <div
      style={{
        marginLeft: 50, // align with assistant text column
        border: `1px solid ${TOKENS.borderDefault}`,
        borderRadius: 14,
        background: TOKENS.bgSurfaceMuted,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          borderBottom: `1px solid ${TOKENS.borderSubtle}`,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: TOKENS.layersViolet,
          }}
        >
          Tool call
        </span>
        <span
          style={{
            fontFamily: `"JetBrains Mono", "SF Mono", ui-monospace, monospace`,
            fontSize: 16,
            color: TOKENS.ink,
            flex: 1,
            fontWeight: 500,
          }}
        >
          {TOOL_CALL}
        </span>
        {spinnerActive ? (
          <Spinner rot={rot} />
        ) : (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: TOKENS.layersMint,
            }}
          >
            ✓ ok
          </span>
        )}
      </div>

      <div
        style={{
          maxHeight: 280 * resultProgress,
          opacity: resultOpacity,
          overflow: "hidden",
          transition: "none",
        }}
      >
        <pre
          style={{
            margin: 0,
            padding: "18px 22px",
            fontFamily: `"JetBrains Mono", "SF Mono", ui-monospace, monospace`,
            fontSize: 15.5,
            lineHeight: 1.55,
            color: TOKENS.ink,
            background: TOKENS.bgSurface,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <code>{TOOL_RESULT}</code>
        </pre>
      </div>
    </div>
  );
};

const Spinner: React.FC<{ rot: number }> = ({ rot }) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    style={{ transform: `rotate(${rot}deg)` }}
    aria-hidden
  >
    <circle
      cx={12}
      cy={12}
      r={9}
      fill="none"
      stroke={TOKENS.borderDefault}
      strokeWidth={2.5}
    />
    <path
      d="M 12 3 A 9 9 0 0 1 21 12"
      fill="none"
      stroke={TOKENS.layersMint}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
  </svg>
);
