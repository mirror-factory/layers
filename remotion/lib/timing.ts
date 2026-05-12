/**
 * Scene timing for the PROD-388 product explainer.
 *
 * Frame rate is locked at 30 fps so durations expressed in seconds map cleanly
 * to round frame counts. Total runtime is 85s, comfortably inside the 60-90s
 * window in the Linear ticket and leaving margin for a future voiceover that
 * will need a tail breath.
 */

export const FPS = 30;

export const SCENES = {
  coldOpen: { from: 0, duration: 6 },
  record: { from: 6, duration: 16 },
  memory: { from: 22, duration: 18 },
  search: { from: 40, duration: 18 },
  mcp: { from: 58, duration: 20 },
  cta: { from: 78, duration: 7 },
} as const;

export const TOTAL_SECONDS = 85;
export const TOTAL_FRAMES = TOTAL_SECONDS * FPS;

export function seconds(n: number): number {
  return Math.round(n * FPS);
}
