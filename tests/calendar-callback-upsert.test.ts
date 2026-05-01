import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  encryptCalendarToken: vi.fn(),
  hasCalendarTokenKey: vi.fn(),
  exchangeCalendarCode: vi.fn(),
  fetchCalendarProfile: vi.fn(),
  hasRequiredCalendarScope: vi.fn(),
  getSupabaseServer: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/lib/calendar/crypto", () => ({
  encryptCalendarToken: mocks.encryptCalendarToken,
  hasCalendarTokenKey: mocks.hasCalendarTokenKey,
}));

vi.mock("@/lib/calendar/providers", () => ({
  calendarScopesFromToken: (scope: string | null) =>
    scope?.split(/\s+/).filter(Boolean) ?? [],
  exchangeCalendarCode: mocks.exchangeCalendarCode,
  fetchCalendarProfile: mocks.fetchCalendarProfile,
  hasRequiredCalendarScope: mocks.hasRequiredCalendarScope,
  parseCalendarProvider: (value: string | string[] | undefined) => {
    const provider = Array.isArray(value) ? value[0] : value;
    return provider === "google" || provider === "outlook" ? provider : null;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: mocks.getSupabaseServer,
}));

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
}));

const route = await import("@/app/api/calendar/callback/[provider]/route");

function request(): NextRequest {
  return new NextRequest(
    "http://127.0.0.1:3000/api/calendar/callback/google?code=code_1&state=state_1",
    {
      method: "GET",
      headers: {
        cookie: "lo_calendar_oauth_google=state_1",
        "x-request-id": "req_calendar_callback",
      },
    },
  );
}

function routeCtx(provider = "google") {
  return { params: Promise.resolve({ provider }) };
}

describe("GET /api/calendar/callback/[provider]", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.getCurrentUserId.mockResolvedValue("user_a");
    mocks.hasCalendarTokenKey.mockReturnValue(true);
    mocks.encryptCalendarToken.mockImplementation((value: string | null) =>
      value ? `enc:${value}` : null,
    );
    mocks.exchangeCalendarCode.mockResolvedValue({
      accessToken: "access_1",
      refreshToken: "refresh_1",
      expiresAt: "2026-05-01T12:00:00.000Z",
      scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
    });
    mocks.hasRequiredCalendarScope.mockReturnValue(true);
    mocks.fetchCalendarProfile.mockResolvedValue({
      id: "google_account_1",
      email: "person@example.com",
    });
  });

  it("saves a calendar connection using the migrated column names and types", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.getSupabaseServer.mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });

    const res = await route.GET(request(), routeCtx());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("calendar=connected");
    expect(upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ provider_account_id: expect.anything() }),
      { onConflict: "user_id,provider" },
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_a",
        provider: "google",
        provider_account_email: "person@example.com",
        status: "connected",
        scopes: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/calendar.readonly",
        ],
        access_token_enc: "enc:access_1",
        refresh_token_enc: "enc:refresh_1",
      }),
      { onConflict: "user_id,provider" },
    );
  });
});
