/**
 * Microphone permission + capture error copy.
 *
 * PROD-476: surfaces clear, platform-specific recovery instructions when
 * `getUserMedia` (or a native equivalent) is denied. Each platform has a
 * different re-enable path, so we tailor the message instead of leaking the
 * raw DOMException name to the user.
 */

export type RecordingPlatform =
  | "web-chrome"
  | "web-safari"
  | "web-firefox"
  | "web-edge"
  | "web-other"
  | "ios"
  | "android"
  | "electron-mac"
  | "electron-windows"
  | "electron-linux"
  | "unknown";

const DEFAULT_PLATFORM: RecordingPlatform = "unknown";

const PERMISSION_REENABLE_HELP: Record<RecordingPlatform, string> = {
  "web-chrome":
    "Open chrome://settings/content/microphone and allow this site, then reload.",
  "web-safari":
    "Open Safari → Settings → Websites → Microphone and set this site to Allow, then reload.",
  "web-firefox":
    "Click the lock icon in the address bar, choose 'Allow' for the microphone, then reload.",
  "web-edge":
    "Open edge://settings/content/microphone and allow this site, then reload.",
  "web-other":
    "Open this site's settings in your browser, allow microphone access, then reload.",
  ios: "Open Settings → Layers → Microphone and toggle access on. Tap Start again afterwards.",
  android:
    "Open Settings → Apps → Layers → Permissions → Microphone and choose Allow. Tap Start again afterwards.",
  "electron-mac":
    "Open System Settings → Privacy & Security → Microphone and enable Layers, then reopen the app.",
  "electron-windows":
    "Open Settings → Privacy & security → Microphone and allow Layers, then restart the app.",
  "electron-linux":
    "Allow Layers to access your microphone in your system's audio settings, then restart the app.",
  unknown:
    "Allow microphone access in your system or browser settings, then try again.",
};

const MIC_BLOCKED_PREFIX = "Microphone access is blocked.";

function hasErrorShape(err: unknown): err is { name?: string; message?: string } {
  return typeof err === "object" && err !== null;
}

function isPermissionError(name: string, message: string): boolean {
  return (
    name === "NotAllowedError" ||
    name === "SecurityError" ||
    /permission denied|permission.*denied|notallowed/i.test(message)
  );
}

/**
 * Detect the recording platform from the current environment.
 *
 * Order of detection matters: native shells (Capacitor / Electron) must win
 * over generic web because they share the same DOM globals.
 */
export function detectRecordingPlatform(opts?: {
  userAgent?: string;
  isElectron?: boolean;
  electronPlatform?: string | null;
  capacitorPlatform?: "ios" | "android" | "web" | null;
}): RecordingPlatform {
  const cap = opts?.capacitorPlatform;
  if (cap === "ios") return "ios";
  if (cap === "android") return "android";

  if (opts?.isElectron) {
    const platform = opts.electronPlatform ?? "";
    if (platform === "darwin") return "electron-mac";
    if (platform === "win32") return "electron-windows";
    if (platform === "linux") return "electron-linux";
    return "electron-mac"; // Layers ships macOS-first; sensible default.
  }

  const ua = (opts?.userAgent ?? "").toLowerCase();
  if (!ua) return DEFAULT_PLATFORM;

  // iOS WebView / mobile Safari first — they also include "Safari" UA tokens.
  if (/iphone|ipad|ipod/.test(ua)) return "web-safari";
  if (/android/.test(ua)) return "android";

  if (/edg\//.test(ua)) return "web-edge";
  if (/chrome\//.test(ua) && !/edg\//.test(ua)) return "web-chrome";
  if (/firefox\//.test(ua)) return "web-firefox";
  if (/safari\//.test(ua)) return "web-safari";
  return "web-other";
}

/**
 * Map a `getUserMedia` / native-permission error to a human-readable
 * message that includes the platform-specific re-enable instruction.
 *
 * The platform argument is optional so legacy callers (and unit tests) keep
 * working — they fall back to the original "Codex in-app browser" copy.
 */
export function recordingStartErrorMessage(
  err: unknown,
  platform: RecordingPlatform = DEFAULT_PLATFORM,
): string {
  if (hasErrorShape(err)) {
    const name = err.name ?? "";
    const message = err.message ?? "";

    if (isPermissionError(name, message)) {
      return permissionDeniedMessage(platform);
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "No microphone was found. Connect a microphone and try again.";
    }

    if (name === "NotReadableError" || name === "TrackStartError") {
      return "The microphone is already in use by another app. Close the other app and try again.";
    }

    if (message) {
      return message;
    }
  }

  return "Failed to start recording";
}

/**
 * Compose the "permission denied" UI copy for a given platform.
 *
 * Exposed separately so the recorder UI can render the same message before
 * the user has even tapped Start (e.g. when `navigator.permissions.query`
 * already reports `denied`).
 */
export function permissionDeniedMessage(
  platform: RecordingPlatform = DEFAULT_PLATFORM,
): string {
  if (platform === "unknown") {
    // Preserve the legacy localhost/Codex copy for callers that haven't
    // wired platform detection yet — the existing tests assert on it.
    return [
      "Microphone access is blocked. Allow microphone access for localhost:3001 in the browser, then try again.",
      "If no permission prompt appears in the Codex in-app browser, open this page in Chrome or Safari because the embedded browser may not expose microphone capture.",
    ].join(" ");
  }
  return `${MIC_BLOCKED_PREFIX} ${PERMISSION_REENABLE_HELP[platform]}`;
}

export function microphoneUnsupportedMessage(): string {
  return "This browser does not expose microphone recording. Open this page in Chrome, Safari, or the native app build to test live capture.";
}

/**
 * Stable identifier used by the UI to render a re-enable link/CTA.
 *
 * Returned alongside the message so components can wire `aria-label`s and
 * deep-links (`app-settings:`, `chrome://settings/...`) without re-running
 * platform detection.
 */
export function permissionReenableHelp(
  platform: RecordingPlatform = DEFAULT_PLATFORM,
): { platform: RecordingPlatform; instructions: string } {
  return {
    platform,
    instructions:
      PERMISSION_REENABLE_HELP[platform] ?? PERMISSION_REENABLE_HELP.unknown,
  };
}
