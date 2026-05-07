/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mirrorfactory.layers",
  appName: "Layers",
  // webDir must point at an existing directory even though server.url
  // is set. `npx cap sync android` writes capacitor.config.json into
  // android/app/src/main/assets/<webDir>/ and ENOENTs without it. The
  // remote server.url still takes precedence at runtime — users load
  // the live web app, never the local "public" dir.
  webDir: "public",
  backgroundColor: "#0a0a0a",
  server: {
    url:
      process.env.CAPACITOR_SERVER_URL ??
      "https://layers.mirrorfactory.ai",
    cleartext: !!process.env.CAPACITOR_SERVER_URL,
    androidScheme: "https",
    allowNavigation: ["api.assemblyai.com", "layers.mirrorfactory.ai"],
  },
  ios: {
    backgroundColor: "#0a0a0a",
    scrollEnabled: false,
    preferredContentMode: "mobile",
    scheme: "com.mirrorfactory.layers",
  },
  android: {
    allowMixedContent: process.env.NODE_ENV !== "production",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: "LIGHT", // light text on dark background
    },
    Keyboard: {
      resize: "body", // resizes body only, preserves viewport units
      style: "DARK",
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchAutoHide: false,
    },
    LocalNotifications: {
      iconColor: "#14b8a6",
    },
  },
};

export default config;
