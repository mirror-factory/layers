import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  assertDeepgramStreamingTokenScope: vi.fn(),
  getDeepgramApiKey: vi.fn(),
  isDeepgramPermissionError: vi.fn(),
}));

vi.mock("@/lib/deepgram/client", () => ({
  assertDeepgramStreamingTokenScope: mocks.assertDeepgramStreamingTokenScope,
  getDeepgramApiKey: mocks.getDeepgramApiKey,
  isDeepgramPermissionError: mocks.isDeepgramPermissionError,
}));

const healthRoute = await import("@/app/api/health/route");

function request(): NextRequest {
  return new NextRequest("http://localhost:3000/api/health", {
    method: "GET",
    headers: { "x-request-id": "req_health_dg" },
  });
}

describe("/api/health Deepgram streaming-token scope check", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.ASSEMBLYAI_API_KEY;
  });

  it("reports Deepgram down when the parent key cannot mint streaming tokens", async () => {
    const error = new Error("DEEPGRAM_API_KEY scope insufficient");
    mocks.getDeepgramApiKey.mockReturnValue("dg_parent");
    mocks.assertDeepgramStreamingTokenScope.mockRejectedValue(error);
    mocks.isDeepgramPermissionError.mockReturnValue(true);

    const res = await healthRoute.GET(request());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("down");
    expect(body.dependencies.deepgram).toMatchObject({
      status: "down",
      detail: "DEEPGRAM_API_KEY scope insufficient",
    });
    expect(mocks.assertDeepgramStreamingTokenScope).toHaveBeenCalledTimes(1);
  });

  it("reports Deepgram ok after the cached cold-start probe succeeds", async () => {
    mocks.getDeepgramApiKey.mockReturnValue("dg_parent");
    mocks.assertDeepgramStreamingTokenScope.mockResolvedValue(undefined);

    const res = await healthRoute.GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dependencies.deepgram.status).toBe("ok");
  });
});
