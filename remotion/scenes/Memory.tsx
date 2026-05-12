import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { TOKENS, FONT_ITALIC_SERIF } from "../lib/tokens";
import { Card, CardHeader } from "../components/Card";
import { HandwrittenAccent } from "../components/PaperBackground";

/**
 * Scene 02 (22-40s) — Meeting memory card lights up.
 *
 * The recording ends and a single big meeting-memory card glows on, then the
 * three sections (Summary · Decisions · Action items) fill in one by one. The
 * handwritten "your notes →" accent draws itself in once, near the title.
 * This is the only scene that uses the scribble — restraint rule.
 */

export const Memory: React.FC = () => {
  const frame = useCurrentFrame();

  // Map a window starting before frame 0 so the scene's first frame already
  // reads (~50% opaque). Prevents a blank hole at the scene boundary.
  const cardEnter = interpolate(frame, [-6, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The card "lights up" — the glow rises then steadies.
  const glow = interpolate(frame, [16, 50, 90], [0, 1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Handwritten accent draws over ~30 frames starting at frame 36.
  const scribbleProgress = interpolate(frame, [36, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sections appear sequentially.
  const summaryProgress = interpolate(frame, [70, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const decisionsProgress = interpolate(frame, [140, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const actionsProgress = interpolate(frame, [210, 250], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1320,
          opacity: cardEnter,
          transform: `translateY(${interpolate(cardEnter, [0, 1], [20, 0])}px)`,
        }}
      >
        <Card padding={48} glow={glow} radius={28}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 32,
              marginBottom: 32,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: TOKENS.fgMuted,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                Meeting memory
              </div>
              <h2
                style={{
                  fontSize: 52,
                  margin: 0,
                  color: TOKENS.ink,
                  fontWeight: 600,
                  letterSpacing: "-0.022em",
                  lineHeight: 1.05,
                }}
              >
                Onboarding kickoff{" "}
                <em
                  style={{
                    fontFamily: FONT_ITALIC_SERIF,
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: TOKENS.layersMint,
                  }}
                >
                  — May 12
                </em>
              </h2>
            </div>

            <div style={{ paddingTop: 8 }}>
              <HandwrittenAccent
                label="your notes →"
                progress={scribbleProgress}
                color={TOKENS.layersMint}
              />
            </div>
          </div>

          <Section
            title="Summary"
            accent={TOKENS.layersMint}
            progress={summaryProgress}
          >
            <p
              style={{
                margin: 0,
                fontSize: 22,
                color: TOKENS.ink,
                lineHeight: 1.55,
                maxWidth: 900,
              }}
            >
              The team aligned on shipping onboarding first. Jamie owns the
              first-run copy by Friday; Owen reviews Monday before the demo.
              Pricing stays unchanged for this cycle.
            </p>
          </Section>

          <div style={{ height: 28 }} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 28,
            }}
          >
            <Section
              title="Decisions"
              accent={TOKENS.layersViolet}
              progress={decisionsProgress}
            >
              <ul style={listStyle}>
                <li style={liStyle}>Launch staging next week.</li>
                <li style={liStyle}>Onboarding ships before billing polish.</li>
              </ul>
            </Section>
            <Section
              title="Action items"
              accent={TOKENS.layersBlue}
              progress={actionsProgress}
            >
              <ul style={listStyle}>
                <li style={liStyle}>
                  <span style={{ fontWeight: 600 }}>Jamie</span> — draft first-run copy by Fri
                </li>
                <li style={liStyle}>
                  <span style={{ fontWeight: 600 }}>Owen</span> — review Mon before demo
                </li>
                <li style={liStyle}>
                  <span style={{ fontWeight: 600 }}>Sara</span> — log pricing concern
                </li>
              </ul>
            </Section>
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
};

const listStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 10,
};

const liStyle: React.CSSProperties = {
  fontSize: 20,
  color: TOKENS.ink,
  lineHeight: 1.5,
  paddingLeft: 22,
  position: "relative",
};

const Section: React.FC<{
  title: string;
  accent: string;
  progress: number;
  children: React.ReactNode;
}> = ({ title, accent, progress, children }) => {
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translate = interpolate(progress, [0, 1], [10, 0]);
  return (
    <div style={{ opacity, transform: `translateY(${translate}px)` }}>
      <CardHeader title={title} accent={accent} />
      <div style={{ position: "relative" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 4,
            left: 0,
            bottom: 4,
            width: 2,
            background: `color-mix(in oklch, ${accent} 60%, transparent)`,
            borderRadius: 2,
          }}
        />
        <div style={{ paddingLeft: 22 }}>{children}</div>
      </div>
    </div>
  );
};
