import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CANONICAL_APP_URL = "https://layers.mirrorfactory.ai";
const STALE_DOMAIN_PATTERN = /layers\.hustletogether\.com|hustletogether\.com/i;

const runtimeConfigFiles = [
  "app/(public)/sign-in/sign-in-form.tsx",
  "app/auth/callback/route.ts",
  "capacitor.config.ts",
  "components/native-auth-bridge.tsx",
  "electron/main.js",
  "lib/auth/native-oauth.ts",
  "lib/email/onboarding.ts",
  "next.config.ts",
];

describe("auth domain configuration", () => {
  it("keeps runtime auth/navigation config off stale Hustle Together domains", () => {
    for (const file of runtimeConfigFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must not reference stale auth domains`).not.toMatch(
        STALE_DOMAIN_PATTERN,
      );
    }
  });

  it("uses the Mirror Factory Layers production domain for native shells", () => {
    const capacitorConfig = readFileSync("capacitor.config.ts", "utf8");
    const electronMain = readFileSync("electron/main.js", "utf8");

    expect(capacitorConfig).toContain(CANONICAL_APP_URL);
    expect(electronMain).toContain(CANONICAL_APP_URL);
  });

  it("keeps native OAuth on the Layers custom scheme instead of a web fallback", () => {
    const nativeOAuth = readFileSync("lib/auth/native-oauth.ts", "utf8");

    expect(nativeOAuth).toContain("com.mirafactory.layers://auth/callback");
    expect(nativeOAuth).toContain("redirectTo: NATIVE_OAUTH_REDIRECT_URL");
  });
});
