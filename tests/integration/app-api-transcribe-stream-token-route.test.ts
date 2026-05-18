/**
 * PROD-321 -- Behavior tests for /api/transcribe/stream/token.
 *
 * Covers:
 *   - happy path (AssemblyAI): returns 200 + token + ws metadata
 *   - vendor key missing (PROD-394 failure mode) -> 502
 *   - quota exhausted -> 402
 *   - meeting-row creation failure -> 503
 *   - two distinct user contexts each receive their own meeting id
 *
 * NOTE: this route does not currently return 401 for unauthenticated
 * callers; it relies on Supabase RLS at the store layer. The "different
 * user" probe asked for in PROD-321 is encoded as the multi-user mint test
 * below (each call mints its own meeting id and writes to its own store).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fixtureUsers } from "../fixtures/users";

const mocks = vi.hoisted(() => ({
  checkQuota: vi.fn(),
  getAssemblyAI: vi.fn(),
  getDeepgramClient: vi.fn(),
  createDeepgramStreamingToken: vi.fn(),
  getSettings: vi.fn(),
  getMeetingsStore: vi.fn(),
  getCurrentUserId: vi.fn(),
  withExternalCall: vi.fn(),
}));

vi.mock("@/lib/billing/quota", () => ({
  checkQuota: mocks.checkQuota,
}));

vi.mock("@/lib/assemblyai/client", () => ({
  getAssemblyAI: mocks.getAssemblyAI,
}));

vi.mock("@/lib/deepgram/client", () => ({
  getDeepgramClient: mocks.getDeepgramClient,
  createDeepgramStreamingToken: mocks.createDeepgramStreamingToken,
}));

vi.mock("@/lib/settings", () => ({
  getSettings: mocks.getSettings,
}));

vi.mock("@/lib/meetings/store", () => ({
  getMeetingsStore: mocks.getMeetingsStore,
}));

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getSupabaseUser: vi.fn(),
}));

vi.mock("@/lib/with-external", () => ({
  withExternalCall: mocks.withExternalCall,
}));

const tokenRoute = await import("@/app/api/transcribe/stream/token/route");

function jsonRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/transcribe/stream/token", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "req_st" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function allowedQuota() {
  return {
    allowed: true,
    planId: "free",
    monthlyMinutesUsed: 0,
    minuteLimit: 120,
    meetingCount: 0,
    meetingLimit: 25,
  };
}

describe("PROD-321 -- /api/transcribe/stream/token behavior", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.checkQuota.mockResolvedValue(allowedQuota());
    mocks.getCurrentUserId.mockResolvedValue("user_a");
    mocks.getSettings.mockResolvedValue({
      summaryModel: "openai/gpt-5.4-nano",
      batchSpeechModel: "universal-2",
      streamingSpeechModel: "universal-streaming-multilingual",
    });
    mocks.getMeetingsStore.mockResolvedValue({
      insert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      get: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    });
    mocks.withExternalCall.mockImplementation(async (_meta, fn) => fn());
  });

  it("returns 200 + token + ws metadata for the AssemblyAI happy path", async () => {
    const createTemporaryToken = vi.fn().mockResolvedValue("aai_temp_abc");
    mocks.getAssemblyAI.mockReturnValue({
      streaming: { createTemporaryToken },
    });

    const res = await tokenRoute.POST(jsonRequest({ meetingTitle: "Standup" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req_st");
    expect(body).toMatchObject({
      provider: "assemblyai",
      token: "aai_temp_abc",
      sampleRate: 16000,
    });
    expect(typeof body.meetingId).toBe("string");
    expect(typeof body.wsUrl).toBe("string");
    expect(body.wsUrl).toContain("token=aai_temp_abc");
    expect(createTemporaryToken).toHaveBeenCalledWith({
      expires_in_seconds: 600,
    });
  });

  it("returns 502 when the AssemblyAI key is missing (PROD-394)", async () => {
    mocks.getAssemblyAI.mockReturnValue(null);

    const res = await tokenRoute.POST(jsonRequest());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toMatchObject({
      code: "missing_stt_api_key",
      provider: "assemblyai",
      envVar: "ASSEMBLYAI_API_KEY",
    });
    expect(body.error).toContain("ASSEMBLYAI_API_KEY");
  });

  it("returns 402 with upgrade copy when the quota is exhausted", async () => {
    mocks.checkQuota.mockResolvedValue({
      allowed: false,
      reason: "minute_limit",
      planId: "free",
      meetingCount: 0,
      meetingLimit: 25,
      monthlyMinutesUsed: 120,
      minuteLimit: 120,
    });

    const res = await tokenRoute.POST(jsonRequest());
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body).toMatchObject({
      code: "free_limit_reached",
      upgradeUrl: "/pricing",
    });
    expect(mocks.getAssemblyAI).not.toHaveBeenCalled();
  });

  it("returns 503 when the meeting row cannot be created before token mint", async () => {
    mocks.getAssemblyAI.mockReturnValue({
      streaming: { createTemporaryToken: vi.fn() },
    });
    mocks.getMeetingsStore.mockResolvedValue({
      insert: vi.fn().mockRejectedValue(new Error("supabase down")),
      update: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    });

    const res = await tokenRoute.POST(jsonRequest());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({ error: expect.stringMatching(/meeting/i) });
  });

  it("mints a separate meeting id for each user context (no cross-user reuse)", async () => {
    const createTemporaryToken = vi.fn().mockResolvedValue("aai_temp_xyz");
    mocks.getAssemblyAI.mockReturnValue({
      streaming: { createTemporaryToken },
    });
    const insertA = vi.fn().mockResolvedValue({});
    const insertB = vi.fn().mockResolvedValue({});

    // Reset the default beforeEach getMeetingsStore so the per-call queue
    // below is the only source.
    mocks.getMeetingsStore.mockReset();
    mocks.getCurrentUserId.mockReset();

    // First call: user A
    mocks.getCurrentUserId.mockResolvedValueOnce(fixtureUsers.owner.id);
    mocks.getMeetingsStore.mockResolvedValueOnce({
      insert: insertA,
      update: vi.fn().mockResolvedValue({}),
      get: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    });
    const resA = await tokenRoute.POST(jsonRequest({ meetingTitle: "A call" }));
    const bodyA = await resA.json();

    // Second call: user B
    mocks.getCurrentUserId.mockResolvedValueOnce(fixtureUsers.intruder.id);
    mocks.getMeetingsStore.mockResolvedValueOnce({
      insert: insertB,
      update: vi.fn().mockResolvedValue({}),
      get: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    });
    const resB = await tokenRoute.POST(jsonRequest({ meetingTitle: "B call" }));
    const bodyB = await resB.json();

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(bodyA.meetingId).not.toBe(bodyB.meetingId);
    expect(insertA).toHaveBeenCalledTimes(1);
    expect(insertB).toHaveBeenCalledTimes(1);
    // Each call wrote to its own (per-user) store; the meeting id from one
    // user's mint must not appear in the other user's store insert payload.
    const insertedIdA = (insertA.mock.calls[0]?.[0] as { id: string }).id;
    const insertedIdB = (insertB.mock.calls[0]?.[0] as { id: string }).id;
    expect(insertedIdA).toBe(bodyA.meetingId);
    expect(insertedIdB).toBe(bodyB.meetingId);
  });
});
