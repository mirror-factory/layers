import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  trackedFetch: vi.fn(),
  assertDeepgramStreamingTokenScope: vi.fn(),
  isDeepgramPermissionError: vi.fn(),
}));

vi.mock("@/lib/integration-usage", () => ({
  trackedFetch: mocks.trackedFetch,
}));

vi.mock("@/lib/deepgram/client", () => ({
  assertDeepgramStreamingTokenScope: mocks.assertDeepgramStreamingTokenScope,
  getDeepgramApiKey: () => process.env.DEEPGRAM_API_KEY?.trim() || null,
  isDeepgramPermissionError: mocks.isDeepgramPermissionError,
}));

const healthRoute = await import("@/app/api/health/route");

describe("app/api/health/route.ts integration behavior", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.trackedFetch.mockReset();
    mocks.assertDeepgramStreamingTokenScope.mockReset();
    mocks.isDeepgramPermissionError.mockReset();
  });

  function stubOnlyDeepgramEnv(apiKey: string) {
    vi.stubEnv("DEEPGRAM_API_KEY", apiKey);
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "");
    vi.stubEnv("ASSEMBLYAI_API_KEY", "");
  }

  it("checks Deepgram streaming-token grant scope when a key is configured", async () => {
    stubOnlyDeepgramEnv("dg_member_key");
    mocks.assertDeepgramStreamingTokenScope.mockResolvedValue(undefined);

    const res = await healthRoute.GET(
      new NextRequest("http://localhost/api/health"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.dependencies.deepgram).toMatchObject({ status: "ok" });
    expect(mocks.assertDeepgramStreamingTokenScope).toHaveBeenCalledOnce();
  });

  it("fails loudly when Deepgram cannot mint streaming tokens", async () => {
    stubOnlyDeepgramEnv("dg_low_scope_key");
    const scopeError = new Error("DEEPGRAM_API_KEY scope insufficient");
    mocks.assertDeepgramStreamingTokenScope.mockRejectedValue(scopeError);
    mocks.isDeepgramPermissionError.mockReturnValue(true);

    const res = await healthRoute.GET(
      new NextRequest("http://localhost/api/health"),
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("down");
    expect(body.dependencies.deepgram).toMatchObject({
      status: "down",
      detail: "DEEPGRAM_API_KEY scope insufficient",
    });
    expect(mocks.isDeepgramPermissionError).toHaveBeenCalledWith(scopeError);
  });
});
