import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TOKENS } from "../lib/tokens";
import { Card } from "../components/Card";

/**
 * Scene 03 (40-58s) — Search across meetings.
 *
 * Search bar types the query, then result cards animate in stacked. The
 * matched card pulses with a mint highlight on the matching snippet. No
 * "AI sparkle" — just typewriter cursor and a quiet pulse on the match.
 */

const QUERY = "pricing decisions";
const QUERY_TYPING_START = 12;
const QUERY_TYPING_END = 90;

const RESULTS = [
  {
    title: "Pricing tier review",
    when: "May 09 · 32 min",
    snippet:
      "Decision: hold current tiers. Revisit after we have onboarding data.",
    matched: true,
  },
  {
    title: "Onboarding kickoff",
    when: "May 12 · 24 min",
    snippet:
      "Pricing stays unchanged for this cycle. Sara to log customer concern.",
    matched: true,
  },
  {
    title: "Q2 GTM planning",
    when: "Apr 28 · 48 min",
    snippet: "Discussed pricing experiments for the Pro tier next quarter.",
    matched: false,
  },
];

export const Search: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [-6, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const typingProgress = interpolate(
    frame,
    [QUERY_TYPING_START, QUERY_TYPING_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const typedLen = Math.round(typingProgress * QUERY.length);
  const typedText = QUERY.slice(0, typedLen);

  // Caret blink — every ~14 frames.
  const caret = Math.floor(frame / 14) % 2 === 0 ? 1 : 0;

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
          gap: 28,
        }}
      >
        {/* Search bar */}
        <Card padding="22px 26px" radius={18}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <SearchIcon />
            <div
              style={{
                flex: 1,
                fontSize: 28,
                color: TOKENS.ink,
                letterSpacing: "-0.005em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {typedText.length === 0 ? (
                <span style={{ color: TOKENS.fgFaint }}>
                  Search every meeting…
                </span>
              ) : (
                <>
                  {typedText}
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 28,
                      background: TOKENS.layersMint,
                      marginLeft: 4,
                      verticalAlign: "middle",
                      opacity: caret,
                    }}
                  />
                </>
              )}
            </div>
            <span
              style={{
                fontSize: 13,
                color: TOKENS.fgMuted,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${TOKENS.borderSubtle}`,
              }}
            >
              ⌘K
            </span>
          </div>
        </Card>

        {/* Results — appear once typing is mostly complete */}
        <div style={{ display: "grid", gap: 18 }}>
          {RESULTS.map((r, i) => (
            <ResultRow
              key={r.title}
              result={r}
              appearAt={QUERY_TYPING_END + 6 + i * 22}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ResultRow: React.FC<{
  result: { title: string; when: string; snippet: string; matched: boolean };
  appearAt: number;
}> = ({ result, appearAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const local = frame - appearAt;
  const enter = spring({
    frame: local,
    fps,
    config: { damping: 200 },
    durationInFrames: 22,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translate = interpolate(enter, [0, 1], [16, 0]);

  // Matched results get a quiet mint pulse when they land.
  const pulse = result.matched
    ? interpolate(
        local,
        [12, 30, 60],
        [0, 1, 0.4],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  if (local < -3) {
    return <div style={{ height: 96 }} />;
  }

  return (
    <Card
      padding="22px 26px"
      radius={16}
      style={{
        opacity,
        transform: `translateY(${translate}px)`,
        borderColor: result.matched
          ? `color-mix(in oklch, ${TOKENS.layersMint} 55%, ${TOKENS.borderDefault} 45%)`
          : TOKENS.borderDefault,
        boxShadow: result.matched
          ? `0 16px 36px -22px color-mix(in oklch, ${TOKENS.layersMint} ${
              40 + pulse * 40
            }%, transparent), 0 4px 12px -8px rgba(20, 30, 50, 0.10)`
          : `0 4px 12px -8px rgba(20, 30, 50, 0.10)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: TOKENS.ink,
            letterSpacing: "-0.005em",
          }}
        >
          {result.title}
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
          {result.when}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 18,
          color: TOKENS.fgMuted,
          lineHeight: 1.5,
        }}
      >
        {result.matched ? (
          <HighlightedSnippet text={result.snippet} pulse={pulse} />
        ) : (
          result.snippet
        )}
      </p>
    </Card>
  );
};

const HighlightedSnippet: React.FC<{ text: string; pulse: number }> = ({
  text,
  pulse,
}) => {
  // Mark the word "Pricing" / "pricing" in the snippet with a mint underline.
  const parts = text.split(/(\bpricing\b|\bPricing\b)/);
  return (
    <>
      {parts.map((part, i) =>
        /pricing/i.test(part) ? (
          <span
            key={i}
            style={{
              background: `color-mix(in oklch, ${TOKENS.layersMintTint} ${
                50 + pulse * 30
              }%, transparent)`,
              padding: "1px 4px",
              borderRadius: 4,
              color: TOKENS.ink,
              fontWeight: 600,
            }}
          >
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

const SearchIcon: React.FC = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden>
    <circle
      cx={11}
      cy={11}
      r={7}
      fill="none"
      stroke={TOKENS.fgMuted}
      strokeWidth={2}
    />
    <line
      x1={16.5}
      y1={16.5}
      x2={21}
      y2={21}
      stroke={TOKENS.fgMuted}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);
