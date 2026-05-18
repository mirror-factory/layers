/**
 * Scene timing for PROD-480 — Mirror Factory intro video.
 *
 * Top-of-mind teaser, not a feature walkthrough. 32 seconds at 30fps so the
 * five scenes land on round-frame boundaries and Remotion can stretch any
 * future voiceover into the same windows without re-cutting timing.
 *
 *   0-4s   Phrase      "Wherever you are."
 *   4-12s  Islands     constellation of context moments
 *  12-20s  LayersFirst meeting card becomes the focal point
 *  20-28s  MoreComing  other islands return to the periphery
 *  28-32s  Aperture    Mirror Factory mark + tagline
 */

export const INTRO_FPS = 30;

export const INTRO_SCENES = {
  phrase: { from: 0, duration: 4 },
  islands: { from: 4, duration: 8 },
  layersFirst: { from: 12, duration: 8 },
  moreComing: { from: 20, duration: 8 },
  aperture: { from: 28, duration: 4 },
} as const;

export const INTRO_TOTAL_SECONDS = 32;
export const INTRO_TOTAL_FRAMES = INTRO_TOTAL_SECONDS * INTRO_FPS;

export function introSeconds(n: number): number {
  return Math.round(n * INTRO_FPS);
}
