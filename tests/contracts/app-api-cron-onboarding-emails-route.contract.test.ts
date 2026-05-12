/**
 * Contract test for the daily onboarding-email cron (PROD-390).
 *
 * Covers:
 *   - Unauthorized GET returns 401.
 *   - `Authorization: Bearer ${CRON_SECRET}` is accepted.
 *   - `x-vercel-cron: 1` header is accepted.
 *   - Successful response shape: `{ ok: true, ...counters }`.
 *
 * Resend, Supabase, and auth.admin are stubbed so the route runs in a clean
 * in-memory environment with no network or DB.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  getSupabaseServer: vi.fn(),
}));

const resendMock = vi.hoisted(() => ({
  getResend: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => supabaseMock);
vi.mock("@/lib/email/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/client")>();
  return { ...actual, getResend: resendMock.getResend };
});

describe("GET /api/cron/onboarding-emails", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-secret" };

    supabaseMock.getSupabaseServer.mockReturnValue({
      from: (_table: string) => ({
        select: () => ({
          is: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
      auth: {
        admin: {
          getUserById: () => Promise.resolve({ data: { user: null } }),
        },
      },
    });

    resendMock.getResend.mockReturnValue({
      emails: { send: vi.fn(async () => ({ data: { id: "x" }, error: null })) },
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.clearAllMocks();
  });

  async function call(headers: Record<string, string> = {}): Promise<Response> {
    const { GET } = await import("@/app/api/cron/onboarding-emails/route");
    const req = new Request("http://localhost/api/cron/onboarding-emails", {
      method: "GET",
      headers,
    });
    return GET(req as unknown as Parameters<typeof GET>[0]);
  }

  it("returns 401 when neither vercel-cron header nor bearer secret is provided", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("accepts a x-vercel-cron header", async () => {
    const res = await call({ "x-vercel-cron": "1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      firstMeetingNudgeSent: 0,
      firstMeetingNudgeSkipped: 0,
      weekOneFollowupSent: 0,
      weekOneFollowupSkipped: 0,
    });
  });

  it("accepts a Bearer CRON_SECRET", async () => {
    const res = await call({ authorization: "Bearer test-secret" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects an incorrect Bearer token", async () => {
    const res = await call({ authorization: "Bearer wrong-secret" });
    expect(res.status).toBe(401);
  });

  it("propagates the request id header", async () => {
    const res = await call({ "x-vercel-cron": "1" });
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});
