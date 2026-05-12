import { Config } from "@remotion/cli/config";

/**
 * Remotion config for the PROD-388 product explainer.
 *
 * - Entry point: `remotion/index.ts` (registers the Root composition).
 * - 1080p H.264 / yuv420p so the file plays everywhere (Vimeo, YouTube,
 *   `<video>` tag, Quicktime) without re-encoding.
 * - Concurrency left to the renderer's default; bump with `--concurrency` for
 *   bigger machines.
 */

Config.setEntryPoint("./remotion/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setOverwriteOutput(true);

// Use the chromium that ships with @remotion/renderer. Renaming the chrome
// flags would only matter if we hit a render-time bug in a future scene.
