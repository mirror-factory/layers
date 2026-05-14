import React from "react";
import { Composition } from "remotion";
import { ExplainerComposition } from "./Composition";
import { IntroComposition } from "./scenes/intro/IntroComposition";
import { BrandTemplateComposition } from "./scenes/brand-template/BrandTemplateComposition";
import { FPS, TOTAL_FRAMES } from "./lib/timing";
import { INTRO_FPS, INTRO_TOTAL_FRAMES } from "./lib/intro-timing";
import { FPS as BRAND_FPS, TOTAL_FRAMES as BRAND_TOTAL_FRAMES } from "./scenes/brand-template/timing";

/**
 * Registry for the PROD-388 product explainer, the PROD-480 Mirror Factory
 * intro, and the PROD-499 brand template (a forkable scene used for release
 * videos, recaps, and social cutdowns). Each composition is fully
 * independent — share components and tokens via `remotion/components/*` and
 * `remotion/lib/*` rather than this file.
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
      <Composition
        id="BrandTemplate"
        component={BrandTemplateComposition}
        durationInFrames={BRAND_TOTAL_FRAMES}
        fps={BRAND_FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
