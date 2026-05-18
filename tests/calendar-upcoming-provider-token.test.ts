import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  getSupabaseUser: vi.fn(),
  getSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getSupabaseUser: mocks.getSupabaseUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: mocks.getSupabaseServer,
}));

const route = await import("@/app/api/calendar/upcoming/route");

function request(path = "/api/calendar/upcoming?limit=10"): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "GET",
    headers: { "x-request-id": "req_calendar" },
  });
}

function tableMissingSupabase(providerToken?: string | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: providerToken
            ? {
                provider_token: providerToken,
                user: { email: "person@example.com" },
              }
            : null,
        },
        error: null,
      }),
    },
    from: vi.fn(() => query),
  };
}

describe("GET /api/calendar/upcoming calendar connection state", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    vi.restoreAllMocks();
    mocks.getCurrentUserId.mockResolvedValue("user_a");
    mocks.getSupabaseServer.mockReturnValue(null);
  });

  it("does not treat the Supabase Google sign-in provider token as a calendar connection", async () => {
    mocks.getSupabaseUser.mockResolvedValue(tableMissingSupabase("google_access"));
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const res = await route.GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      connected: false,
      provider: null,
      accountEmail: null,
      setupRequired: true,
      reauthRequired: false,
      calendarFetchFailed: false,
      calendarRateLimited: false,
      items: [],
    });
  });

  it("returns a connect state when the Supabase session has no provider token", async () => {
    mocks.getSupabaseUser.mockResolvedValue(tableMissingSupabase(null));
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const res = await route.GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      connected: false,
      provider: null,
      items: [],
      setupRequired: true,
      reauthRequired: false,
      calendarFetchFailed: false,
      calendarRateLimited: false,
    });
  });
});
