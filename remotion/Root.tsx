import React from "react";
import { Composition } from "remotion";
import { ExplainerComposition } from "./Composition";
import { FPS, TOTAL_FRAMES } from "./lib/timing";

/**
 * Registry for the PROD-388 product explainer. Single composition for now;
 * social cuts (30s LinkedIn / 15s X) per the Linear ticket can be added here
 * as additional `<Composition>` entries with their own duration windows.
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
    </>
  );
};
