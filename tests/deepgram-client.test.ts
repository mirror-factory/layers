import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  grant: vi.fn(),
  deepgramClient: vi.fn(),
}));

vi.mock("@deepgram/sdk", () => ({
  DeepgramClient: mocks.deepgramClient,
}));

import {
  __resetDeepgramClientForTests,
  assertDeepgramStreamingTokenScope,
  DeepgramConfigurationError,
  DeepgramStreamingTokenScopeError,
  getDeepgramApiKey,
  getDeepgramClient,
  isDeepgramPermissionError,
  requireDeepgramClient,
} from "@/lib/deepgram/client";

describe("Deepgram client diagnostics", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    __resetDeepgramClientForTests();
    mocks.grant.mockReset();
    mocks.deepgramClient.mockReset();
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

  it("runs the streaming token scope check once per API key", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg_member_key");
    mocks.grant.mockResolvedValue({ access_token: "scope_probe" });
    mocks.deepgramClient.mockImplementation(() => ({
      auth: { v1: { tokens: { grant: mocks.grant } } },
    }));

    await assertDeepgramStreamingTokenScope();
    await assertDeepgramStreamingTokenScope();

    expect(mocks.deepgramClient).toHaveBeenCalledOnce();
    expect(mocks.grant).toHaveBeenCalledOnce();
    expect(mocks.grant).toHaveBeenCalledWith({ ttl_seconds: 1 });
  });

  it("fails loudly when the Deepgram API key cannot grant streaming tokens", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg_low_scope_key");
    mocks.grant.mockRejectedValue({
      statusCode: 403,
      body: {
        err_code: "FORBIDDEN",
        err_msg: "Insufficient permissions.",
      },
    });
    mocks.deepgramClient.mockImplementation(() => ({
      auth: { v1: { tokens: { grant: mocks.grant } } },
    }));

    await expect(assertDeepgramStreamingTokenScope()).rejects.toThrow(
      DeepgramStreamingTokenScopeError,
    );
    await expect(assertDeepgramStreamingTokenScope()).rejects.toThrow(
      "DEEPGRAM_API_KEY scope insufficient",
    );
  });

  it("retries transient scope-check failures", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg_member_key");
    mocks.grant
      .mockRejectedValueOnce(new Error("Deepgram unavailable"))
      .mockResolvedValueOnce({ access_token: "scope_probe" });
    mocks.deepgramClient.mockImplementation(() => ({
      auth: { v1: { tokens: { grant: mocks.grant } } },
    }));

    await expect(assertDeepgramStreamingTokenScope()).rejects.toThrow(
      "Deepgram unavailable",
    );
    await assertDeepgramStreamingTokenScope();

    expect(mocks.grant).toHaveBeenCalledTimes(2);
  });

  it("detects Deepgram permission errors from SDK responses", () => {
    expect(
      isDeepgramPermissionError({
        statusCode: 403,
        body: { err_code: "FORBIDDEN" },
      }),
    ).toBe(true);
    expect(
      isDeepgramPermissionError({
        message: "Deepgram request failed: insufficient permissions",
      }),
    ).toBe(true);
    expect(
      isDeepgramPermissionError({
        response: {
          status: 403,
          data: { err_msg: "Insufficient permissions." },
        },
      }),
    ).toBe(true);
  });
});
