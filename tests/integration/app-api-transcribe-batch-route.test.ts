/**
 * PROD-321 -- Behavior tests for /api/transcribe (batch).
 *
 * Covers:
 *   - happy path: small audio fixture -> 202 + processing transcript shape
 *   - malformed payload (no multipart body) -> 400
 *   - missing audio file in form -> 400
 *   - oversize file -> 413
 *   - quota exhausted -> 402
 *   - vendor unavailable (no AssemblyAI key) -> 502
 *
 * NOTE: this route does not currently perform an explicit auth check; it
 * delegates to Supabase RLS via the meetings store. There is no code path
 * that returns 401 today, so the "missing-auth -> 401" probe asked for in
 * PROD-321 is documented as a gap below rather than asserted.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAssemblyAI: vi.fn(),
  getBatchSpeechModelsFromSettings: vi.fn(),
  checkQuota: vi.fn(),
  getMeetingsStore: vi.fn(),
  getCurrentUserId: vi.fn(),
  withExternalCall: vi.fn(),
}));

vi.mock("@/lib/assemblyai/client", () => ({
  getAssemblyAI: mocks.getAssemblyAI,
  getBatchSpeechModelsFromSettings: mocks.getBatchSpeechModelsFromSettings,
}));

vi.mock("@/lib/billing/quota", () => ({
  checkQuota: mocks.checkQuota,
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

const transcribeRoute = await import("@/app/api/transcribe/route");

function audioBlob(byteLength = 1024): Blob {
  const buf = new Uint8Array(byteLength).fill(7);
  return new Blob([buf], { type: "audio/wav" });
}

function multipartRequest(form: FormData): NextRequest {
  return new NextRequest("http://localhost:3000/api/transcribe", {
    method: "POST",
    headers: { "x-request-id": "req_t" },
    body: form,
  });
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/transcribe", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "req_t" },
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

describe("PROD-321 -- /api/transcribe batch behavior", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.checkQuota.mockResolvedValue(allowedQuota());
    mocks.getCurrentUserId.mockResolvedValue("user_a");
    mocks.getBatchSpeechModelsFromSettings.mockResolvedValue(["universal-2"]);
    mocks.withExternalCall.mockImplementation(async (_meta, fn) => fn());
    mocks.getMeetingsStore.mockResolvedValue({
      insert: vi.fn().mockResolvedValue({}),
      update: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    });
  });

  it("returns 202 + { id, status: 'processing' } on the happy path", async () => {
    const filesUpload = vi
      .fn()
      .mockResolvedValue("https://uploads.assemblyai.test/audio.wav");
    const transcriptsSubmit = vi
      .fn()
      .mockResolvedValue({ id: "transcript_123", status: "queued" });
    mocks.getAssemblyAI.mockReturnValue({
      files: { upload: filesUpload },
      transcripts: { submit: transcriptsSubmit },
    });

    const form = new FormData();
    form.set("audio", audioBlob(2048), "clip.wav");

    const res = await transcribeRoute.POST(multipartRequest(form), undefined);
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(res.headers.get("x-request-id")).toBe("req_t");
    expect(body).toMatchObject({ id: "transcript_123", status: "processing" });
    expect(filesUpload).toHaveBeenCalled();
    expect(transcriptsSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        audio_url: "https://uploads.assemblyai.test/audio.wav",
        speaker_labels: true,
      }),
    );
  });

  it("returns 400 when the request body is not valid multipart form data", async () => {
    const res = await transcribeRoute.POST(jsonRequest({ not: "form" }), undefined);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: expect.stringMatching(/form|audio/i) });
    expect(mocks.getAssemblyAI).not.toHaveBeenCalled();
  });

  it("returns 400 when the multipart form is missing the audio field", async () => {
    const form = new FormData();
    form.set("notes", "no audio attached");

    const res = await transcribeRoute.POST(multipartRequest(form), undefined);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: expect.stringMatching(/audio/i) });
    expect(mocks.getAssemblyAI).not.toHaveBeenCalled();
  });

  it("returns 413 when the audio file exceeds the 100MB limit", async () => {
    // Stub `formData()` directly so we can return an oversize Blob whose
    // size property is not normalized away by the underlying multipart
    // parser.
    const big = new Blob([new Uint8Array(8)], { type: "audio/wav" });
    Object.defineProperty(big, "size", { value: 200 * 1024 * 1024 });
    const form = new FormData();
    form.set("audio", big, "huge.wav");

    const req = new NextRequest("http://localhost:3000/api/transcribe", {
      method: "POST",
      headers: { "x-request-id": "req_t" },
    });
    Object.defineProperty(req, "formData", {
      value: async () => form,
    });

    const res = await transcribeRoute.POST(req, undefined);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body).toMatchObject({ error: expect.stringMatching(/100MB|limit/i) });
    expect(mocks.getAssemblyAI).not.toHaveBeenCalled();
  });

  it("returns 402 with upgrade copy when the user quota is exhausted", async () => {
    mocks.checkQuota.mockResolvedValue({
      allowed: false,
      reason: "meeting_limit",
      planId: "free",
      meetingCount: 25,
      meetingLimit: 25,
      monthlyMinutesUsed: 0,
      minuteLimit: 120,
    });

    const form = new FormData();
    form.set("audio", audioBlob(), "clip.wav");

    const res = await transcribeRoute.POST(multipartRequest(form), undefined);
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body).toMatchObject({
      code: "free_limit_reached",
      upgradeUrl: "/pricing",
    });
    expect(mocks.getAssemblyAI).not.toHaveBeenCalled();
  });

  it("returns 502 when the AssemblyAI client cannot be configured (vendor unavailable)", async () => {
    mocks.getAssemblyAI.mockReturnValue(null);

    const form = new FormData();
    form.set("audio", audioBlob(), "clip.wav");

    const res = await transcribeRoute.POST(multipartRequest(form), undefined);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toMatchObject({ error: expect.stringMatching(/AssemblyAI/i) });
  });

  // PROD-321 follow-up gap (documented, not asserted):
  //   The current /api/transcribe route does not return 401 for missing auth;
  //   it relies on Supabase RLS at the store layer. Adding an explicit auth
  //   check would change the contract from [202, 400, 402, 413, 502, 503] to
  //   include 401. Tracked separately rather than introduced here.
});
