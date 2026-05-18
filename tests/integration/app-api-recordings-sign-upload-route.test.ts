/**
 * Coverage anchor for /api/recordings/sign-upload (PROD-473).
 *
 * The route is exercised in production via the client upload flow:
 *   client → POST /api/recordings/sign-upload → Supabase Storage signed URL
 *   client uploads directly to the signed URL
 *   client → POST /api/transcribe with { storagePath } → AssemblyAI fetch
 *
 * This file imports the route handler and asserts the surface contract
 * (auth gate + Zod validation) so `tests/route-coverage.test.ts` sees
 * this route as exercised. Deeper coverage lives in
 * tests/unit/recording-storage.test.ts (Zod schemas + path helpers).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "@/app/api/recordings/sign-upload/route";

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(),
}));

import { getCurrentUserId } from "@/lib/supabase/user";
import { getSupabaseServer } from "@/lib/supabase/server";

function jsonRequest(body: unknown): NextRequest {
  // The Next.js route helper expects NextRequest; in tests a plain Request
  // satisfies the runtime surface our handler reads (headers, json()), so
  // we cast via unknown to avoid pulling in next/server's full surface.
  return new Request("https://layers.test/api/recordings/sign-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const noopCtx = {
  requestId: "req",
  startedAt: 0,
} as unknown as Parameters<typeof POST>[1];

describe("POST /api/recordings/sign-upload", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUserId).mockReset();
    vi.mocked(getSupabaseServer).mockReset();
  });

  it("returns 401 when the caller is not signed in", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const res = await POST(
      jsonRequest({ contentType: "audio/webm", sizeBytes: 1024 }),
      noopCtx,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when the request body fails Zod validation (unsupported mime)", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user_a");
    const res = await POST(
      jsonRequest({ contentType: "video/mp4", sizeBytes: 1024 }),
      noopCtx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 503 when Supabase storage is not configured", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user_a");
    vi.mocked(getSupabaseServer).mockReturnValue(null);
    const res = await POST(
      jsonRequest({ contentType: "audio/webm", sizeBytes: 4_000_000 }),
      noopCtx,
    );
    expect(res.status).toBe(503);
  });
});
