/**
 * Brand template timing — PROD-499.
 *
 * 40s @ 30fps = 1200 frames. Each beat is its own Sequence so the template is
 * forkable: cut to just the wedge, or the outro, or chain them in a new order.
 * Frame allocations bake in a half-second crossfade overlap between adjacent
 * sequences so motion never hard-cuts.
 */

export const FPS = 30;

export const BEATS = {
  coldOpen:    { from:   0, duration: 4 * 30 },     //   0 –  120
  wedge:       { from: 100, duration: 8 * 30 },     // 100 –  340  (overlaps cold open by 20)
  faceToDot:   { from: 320, duration: 6 * 30 },     // 320 –  500
  layers:      { from: 480, duration: 8 * 30 },     // 480 –  720
  contextFlow: { from: 700, duration: 8 * 30 },     // 700 –  940
  outro:       { from: 920, duration: 6 * 30 },     // 920 – 1100
} as const;

export const TOTAL_FRAMES = 1100;
export const TOTAL_SECONDS = TOTAL_FRAMES / FPS;

export function seconds(n: number): number {
  return Math.round(n * FPS);
}
