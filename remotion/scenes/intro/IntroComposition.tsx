import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

import { PaperBackground } from "../../components/PaperBackground";
import { Phrase } from "./Phrase";
import { Islands } from "./Islands";
import { LayersFirst } from "./LayersFirst";
import { MoreComing } from "./MoreComing";
import { Aperture } from "./Aperture";
import { INTRO_SCENES } from "../../lib/intro-timing";

// Fonts. Mirrors the loading pattern in Composition.tsx so the first rendered
// frames don't flash a system fallback.
const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const BODY = inter.fontFamily;

/**
 * PROD-480 — Mirror Factory intro video.
 *
 * 32s teaser at 30fps, 1920×1080. Five scenes laid out top-down: paper sits
 * behind everything, each scene gets its own Sequence window with a one-frame
 * pre-mount so the entrance interpolations are warm on the boundary frame.
 *
 * No CaptionTrack — the on-screen text IS the message (per the Linear ticket;
 * captions/VO are a follow-up).
 */
export const IntroComposition: React.FC = () => {
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
        from={f(INTRO_SCENES.phrase.from)}
        durationInFrames={f(INTRO_SCENES.phrase.duration)}
        premountFor={f(1)}
      >
        <Phrase />
      </Sequence>

      <Sequence
        from={f(INTRO_SCENES.islands.from)}
        durationInFrames={f(INTRO_SCENES.islands.duration)}
        premountFor={f(1)}
      >
        <Islands />
      </Sequence>

      <Sequence
        from={f(INTRO_SCENES.layersFirst.from)}
        durationInFrames={f(INTRO_SCENES.layersFirst.duration)}
        premountFor={f(1)}
      >
        <LayersFirst />
      </Sequence>

      <Sequence
        from={f(INTRO_SCENES.moreComing.from)}
        durationInFrames={f(INTRO_SCENES.moreComing.duration)}
        premountFor={f(1)}
      >
        <MoreComing />
      </Sequence>

      <Sequence
        from={f(INTRO_SCENES.aperture.from)}
        durationInFrames={f(INTRO_SCENES.aperture.duration)}
        premountFor={f(1)}
      >
        <Aperture />
      </Sequence>
    </AbsoluteFill>
  );
};
