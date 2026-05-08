import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tokenGrant: vi.fn(),
}));

vi.mock("@deepgram/sdk", () => ({
  DeepgramClient: vi.fn().mockImplementation(() => ({
    auth: {
      v1: {
        tokens: {
          grant: mocks.tokenGrant,
        },
      },
    },
  })),
}));

import {
  assertDeepgramStreamingTokenScope,
  DeepgramConfigurationError,
  DeepgramScopeError,
  getDeepgramApiKey,
  getDeepgramClient,
  isDeepgramPermissionError,
  requireDeepgramClient,
} from "@/lib/deepgram/client";

describe("Deepgram client diagnostics", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.tokenGrant.mockReset();
  });

  it("returns null when DEEPGRAM_API_KEY is missing", () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "");

    expect(getDeepgramApiKey()).toBeNull();
    expect(getDeepgramClient()).toBeNull();
  });

  it("throws a clear missing-key error when Deepgram is required", () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "");

    expect(() => requireDeepgramClient()).toThrow(DeepgramConfigurationError);
    expect(() => requireDeepgramClient()).toThrow(
      "DEEPGRAM_API_KEY is required for Deepgram transcription",
    );
  });

  it("checks streaming-token scope once per cold-start API key", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg_scope_ok");
    mocks.tokenGrant.mockResolvedValue({ access_token: "dg_temp" });

    await assertDeepgramStreamingTokenScope();
    await assertDeepgramStreamingTokenScope();

    expect(mocks.tokenGrant).toHaveBeenCalledTimes(1);
    expect(mocks.tokenGrant).toHaveBeenCalledWith({ ttl_seconds: 1 });
  });

  it("throws a loud scope error when Deepgram rejects token minting", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg_scope_denied");
    mocks.tokenGrant.mockRejectedValue({
      statusCode: 403,
      body: {
        err_code: "FORBIDDEN",
        err_msg: "Insufficient permissions.",
      },
    });

    await expect(assertDeepgramStreamingTokenScope()).rejects.toThrow(
      DeepgramScopeError,
    );
    await expect(assertDeepgramStreamingTokenScope()).rejects.toThrow(
      "DEEPGRAM_API_KEY scope insufficient",
    );
    expect(mocks.tokenGrant).toHaveBeenCalledTimes(1);
  });

  it("classifies Deepgram permission responses", () => {
    expect(isDeepgramPermissionError(new DeepgramScopeError())).toBe(true);
    expect(
      isDeepgramPermissionError({
        statusCode: 403,
        body: { err_code: "FORBIDDEN" },
      }),
    ).toBe(true);
    expect(isDeepgramPermissionError(new Error("network timeout"))).toBe(false);
  });
});
