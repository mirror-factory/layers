/**
 * Client-side recording platform detection (PROD-476).
 *
 * Wraps the pure `detectRecordingPlatform` helper with browser/Capacitor/
 * Electron global lookups so callers only have to import one function.
 */

import { Capacitor } from "@capacitor/core";
import { isElectron } from "@/lib/electron/bridge";
import {
  detectRecordingPlatform,
  type RecordingPlatform,
} from "@/lib/recording/microphone-errors";

/**
 * Best-effort detection of the current recording platform from runtime
 * globals. Safe to call from a browser context; returns "unknown" during SSR.
 */
export function detectCurrentRecordingPlatform(): RecordingPlatform {
  if (typeof window === "undefined") return "unknown";

  let capacitorPlatform: "ios" | "android" | "web" | null = null;
  try {
    if (Capacitor.isNativePlatform()) {
      const platform = Capacitor.getPlatform();
      if (platform === "ios" || platform === "android") {
        capacitorPlatform = platform;
      }
    }
  } catch {
    capacitorPlatform = null;
  }

  const electron = isElectron();
  const electronPlatform = electron
    ? (window.electronAPI?.platform ?? null)
    : null;

  return detectRecordingPlatform({
    userAgent: window.navigator?.userAgent,
    isElectron: electron,
    electronPlatform,
    capacitorPlatform,
  });
}
