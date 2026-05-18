import { describe, expect, it } from "vitest";
import {
  detectRecordingPlatform,
  microphoneUnsupportedMessage,
  permissionDeniedMessage,
  permissionReenableHelp,
  recordingStartErrorMessage,
} from "@/lib/recording/microphone-errors";

describe("recordingStartErrorMessage", () => {
  it("turns browser permission denials into actionable copy", () => {
    const message = recordingStartErrorMessage(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    expect(message).toContain("Microphone access is blocked");
    expect(message).toContain("localhost:3001");
    expect(message).toContain("Codex in-app browser");
  });

  it("explains missing microphones", () => {
    const message = recordingStartErrorMessage(
      new DOMException("No device", "NotFoundError"),
    );

    expect(message).toBe("No microphone was found. Connect a microphone and try again.");
  });

  it("explains busy microphones", () => {
    const message = recordingStartErrorMessage(
      new DOMException("Already in use", "NotReadableError"),
    );

    expect(message).toBe(
      "The microphone is already in use by another app. Close the other app and try again.",
    );
  });

  it("keeps provider/backend startup errors intact", () => {
    expect(recordingStartErrorMessage(new Error("Token request failed (503)"))).toBe(
      "Token request failed (503)",
    );
  });

  it("explains unsupported embedded browsers", () => {
    expect(microphoneUnsupportedMessage()).toContain("does not expose microphone recording");
  });
});

describe("recordingStartErrorMessage / platform-aware permission denials", () => {
  it("points iOS users at Settings → Layers → Microphone", () => {
    const message = recordingStartErrorMessage(
      new DOMException("Permission denied", "NotAllowedError"),
      "ios",
    );

    expect(message).toContain("Microphone access is blocked");
    expect(message).toContain("Settings");
    expect(message).toContain("Layers");
    expect(message).toContain("Microphone");
  });

  it("points Android users at the app permissions screen", () => {
    const message = recordingStartErrorMessage(
      new DOMException("Permission denied", "NotAllowedError"),
      "android",
    );

    expect(message).toContain("Apps");
    expect(message).toContain("Layers");
    expect(message).toContain("Permissions");
  });

  it("points Electron macOS users at System Settings → Privacy & Security", () => {
    const message = recordingStartErrorMessage(
      new DOMException("Permission denied", "NotAllowedError"),
      "electron-mac",
    );

    expect(message).toContain("System Settings");
    expect(message).toContain("Privacy & Security");
    expect(message).toContain("Microphone");
  });

  it("gives Chrome users the chrome:// settings deep-link", () => {
    const message = recordingStartErrorMessage(
      new DOMException("Permission denied", "NotAllowedError"),
      "web-chrome",
    );

    expect(message).toContain("chrome://settings/content/microphone");
  });

  it("gives Safari users the Safari → Settings → Websites path", () => {
    const message = recordingStartErrorMessage(
      new DOMException("Permission denied", "NotAllowedError"),
      "web-safari",
    );

    expect(message).toContain("Safari");
    expect(message).toContain("Websites");
    expect(message).toContain("Microphone");
  });

  it("gives Firefox users the lock-icon recovery path", () => {
    const message = recordingStartErrorMessage(
      new DOMException("Permission denied", "NotAllowedError"),
      "web-firefox",
    );

    expect(message).toContain("lock icon");
  });

  it("treats SecurityError the same as NotAllowedError", () => {
    const message = recordingStartErrorMessage(
      new DOMException("Origin not allowed", "SecurityError"),
      "ios",
    );

    expect(message).toContain("Microphone access is blocked");
  });

  it("recognises permission denials from plain Error messages", () => {
    const message = recordingStartErrorMessage(
      new Error("getUserMedia: permission denied"),
      "android",
    );

    expect(message).toContain("Microphone access is blocked");
    expect(message).toContain("Apps");
  });
});

describe("permissionDeniedMessage", () => {
  it("returns the legacy localhost copy when the platform is unknown", () => {
    expect(permissionDeniedMessage()).toContain("localhost:3001");
  });

  it("returns the iOS recovery copy", () => {
    expect(permissionDeniedMessage("ios")).toContain("Settings → Layers → Microphone");
  });

  it("returns the Electron Windows recovery copy", () => {
    expect(permissionDeniedMessage("electron-windows")).toContain(
      "Privacy & security",
    );
  });
});

describe("permissionReenableHelp", () => {
  it("returns the platform-specific instruction string", () => {
    expect(permissionReenableHelp("electron-mac")).toEqual({
      platform: "electron-mac",
      instructions: expect.stringContaining("System Settings"),
    });
  });

  it("falls back to a generic instruction when platform is unknown", () => {
    expect(permissionReenableHelp().instructions).toContain(
      "Allow microphone access",
    );
  });
});

describe("detectRecordingPlatform", () => {
  it("prefers Capacitor iOS over user-agent heuristics", () => {
    expect(
      detectRecordingPlatform({
        capacitorPlatform: "ios",
        userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36",
      }),
    ).toBe("ios");
  });

  it("prefers Capacitor Android over user-agent heuristics", () => {
    expect(detectRecordingPlatform({ capacitorPlatform: "android" })).toBe(
      "android",
    );
  });

  it("returns electron-mac when running inside Electron on darwin", () => {
    expect(
      detectRecordingPlatform({ isElectron: true, electronPlatform: "darwin" }),
    ).toBe("electron-mac");
  });

  it("returns electron-windows when running inside Electron on win32", () => {
    expect(
      detectRecordingPlatform({ isElectron: true, electronPlatform: "win32" }),
    ).toBe("electron-windows");
  });

  it("returns electron-linux when running inside Electron on linux", () => {
    expect(
      detectRecordingPlatform({ isElectron: true, electronPlatform: "linux" }),
    ).toBe("electron-linux");
  });

  it("detects mobile Safari on iPhone as web-safari (Capacitor not present)", () => {
    expect(
      detectRecordingPlatform({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      }),
    ).toBe("web-safari");
  });

  it("detects Android Chrome as android even outside Capacitor", () => {
    expect(
      detectRecordingPlatform({
        userAgent:
          "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      }),
    ).toBe("android");
  });

  it("detects desktop Chrome", () => {
    expect(
      detectRecordingPlatform({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      }),
    ).toBe("web-chrome");
  });

  it("detects Edge via the Edg/ token", () => {
    expect(
      detectRecordingPlatform({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      }),
    ).toBe("web-edge");
  });

  it("detects Firefox", () => {
    expect(
      detectRecordingPlatform({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
      }),
    ).toBe("web-firefox");
  });

  it("falls back to unknown when no signals are available", () => {
    expect(detectRecordingPlatform()).toBe("unknown");
  });
});
