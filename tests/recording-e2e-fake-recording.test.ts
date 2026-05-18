import { afterEach, describe, expect, it, vi } from "vitest";
import { isE2eFakeRecordingEnabled } from "@/lib/recording/e2e-fake-recording";

describe("isE2eFakeRecordingEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables the fake recording path only for Playwright test runs", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PLAYWRIGHT", "1");
    vi.stubEnv("LAYERS_E2E_FAKE_RECORDING", "1");

    expect(isE2eFakeRecordingEnabled()).toBe(true);
  });

  it("stays disabled without the Playwright runtime marker", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LAYERS_E2E_FAKE_RECORDING", "1");

    expect(isE2eFakeRecordingEnabled()).toBe(false);
  });

  it("stays disabled in production even when all fake flags are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAYWRIGHT", "1");
    vi.stubEnv("LAYERS_E2E_FAKE_RECORDING", "1");

    expect(isE2eFakeRecordingEnabled()).toBe(false);
  });
});
