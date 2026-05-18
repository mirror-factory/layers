import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";

import { PaperBackground } from "./components/PaperBackground";
import { CaptionTrack } from "./components/Captions";
import { ColdOpen } from "./scenes/ColdOpen";
import { Record } from "./scenes/Record";
import { Memory } from "./scenes/Memory";
import { Search } from "./scenes/Search";
import { Mcp } from "./scenes/Mcp";
import { Cta } from "./scenes/Cta";
import { SCENES } from "./lib/timing";

// Brand type uses a single sans stack. Loading happens at module scope so
// Remotion blocks rendering until the font is on the page.
const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
loadJetBrains("normal", { weights: ["400", "500"], subsets: ["latin"] });

const BODY = inter.fontFamily;

/**
 * Master composition for the PROD-388 explainer video.
 *
 * Layered top-down so paper sits behind everything, each scene gets its own
 * Sequence window, and the caption strip floats on top for the whole runtime.
 */
export const ExplainerComposition: React.FC = () => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);

  return (
    <AbsoluteFill
      style={{
        background: "transparent",
        fontFamily: `${BODY}, "Geist Sans", system-ui, sans-serif`,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>
        {`
          h1, h2, h3 {
            font-family: ${BODY}, "Geist Sans", system-ui, sans-serif;
          }
        `}
      </style>

      <PaperBackground />

      <Sequence
        from={f(SCENES.coldOpen.from)}
        durationInFrames={f(SCENES.coldOpen.duration)}
        premountFor={f(1)}
      >
        <ColdOpen />
      </Sequence>

      <Sequence
        from={f(SCENES.record.from)}
        durationInFrames={f(SCENES.record.duration)}
        premountFor={f(1)}
      >
        <Record />
      </Sequence>

      <Sequence
        from={f(SCENES.memory.from)}
        durationInFrames={f(SCENES.memory.duration)}
        premountFor={f(1)}
      >
        <Memory />
      </Sequence>

      <Sequence
        from={f(SCENES.search.from)}
        durationInFrames={f(SCENES.search.duration)}
        premountFor={f(1)}
      >
        <Search />
      </Sequence>

      <Sequence
        from={f(SCENES.mcp.from)}
        durationInFrames={f(SCENES.mcp.duration)}
        premountFor={f(1)}
      >
        <Mcp />
      </Sequence>

      <Sequence
        from={f(SCENES.cta.from)}
        durationInFrames={f(SCENES.cta.duration)}
        premountFor={f(1)}
      >
        <Cta />
      </Sequence>

      <CaptionTrack />
    </AbsoluteFill>
  );
};
