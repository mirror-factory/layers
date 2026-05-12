import React from "react";
import { Composition } from "remotion";
import { ExplainerComposition } from "./Composition";
import { IntroComposition } from "./scenes/intro/IntroComposition";
import { FPS, TOTAL_FRAMES } from "./lib/timing";
import { INTRO_FPS, INTRO_TOTAL_FRAMES } from "./lib/intro-timing";

/**
 * Registry for the PROD-388 product explainer and the PROD-480 Mirror Factory
 * intro video. Each composition is fully independent — share components and
 * tokens via `remotion/components/*` and `remotion/lib/*` rather than this
 * file.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Composition"
        component={ExplainerComposition}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="MirrorFactoryIntro"
        component={IntroComposition}
        durationInFrames={INTRO_TOTAL_FRAMES}
        fps={INTRO_FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
