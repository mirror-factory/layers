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

describe("GET /api/calendar/upcoming Supabase provider_token path", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    vi.restoreAllMocks();
    mocks.getCurrentUserId.mockResolvedValue("user_a");
    mocks.getSupabaseServer.mockReturnValue(null);
  });

  it("fetches Google Calendar events with the Supabase session provider token", async () => {
    mocks.getSupabaseUser.mockResolvedValue(tableMissingSupabase("google_access"));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "event_1",
              summary: "Product planning",
              start: { dateTime: "2026-05-01T15:00:00.000Z" },
              end: { dateTime: "2026-05-01T15:45:00.000Z" },
              location: "Zoom",
              attendees: [{ email: "a@example.com" }, { email: "b@example.com" }],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const res = await route.GET(request());
    const body = await res.json();
    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));

    expect(res.status).toBe(200);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    expect(calledUrl.searchParams.get("maxResults")).toBe("10");
    expect(calledUrl.searchParams.get("singleEvents")).toBe("true");
    expect(calledUrl.searchParams.get("orderBy")).toBe("startTime");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { authorization: "Bearer google_access" },
    });
    expect(body).toMatchObject({
      connected: true,
      provider: "google",
      accountEmail: "person@example.com",
      setupRequired: true,
      reauthRequired: false,
      calendarFetchFailed: false,
      calendarRateLimited: false,
      items: [
        {
          id: "event_1",
          title: "Product planning",
          startsAt: "2026-05-01T15:00:00.000Z",
          endsAt: "2026-05-01T15:45:00.000Z",
          location: "Zoom",
          attendeesCount: 2,
        },
      ],
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
      reauthRequired: true,
      calendarFetchFailed: false,
      calendarRateLimited: false,
    });
  });

  it("marks reauth required when Google rejects an expired provider token", async () => {
    mocks.getSupabaseUser.mockResolvedValue(tableMissingSupabase("expired_token"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 401 } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await route.GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      connected: true,
      items: [],
      reauthRequired: true,
      calendarFetchFailed: false,
      calendarRateLimited: false,
    });
  });

  it("marks calendar rate limiting separately from generic provider failure", async () => {
    mocks.getSupabaseUser.mockResolvedValue(tableMissingSupabase("rate_limited_token"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 429 } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await route.GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      connected: true,
      items: [],
      reauthRequired: false,
      calendarFetchFailed: false,
      calendarRateLimited: true,
    });
  });
});
