import { describe, expect, it } from "vitest";
import { GOOGLE_CALENDAR_AUTH_SCOPES } from "@/lib/auth/google-oauth";

describe("Google OAuth scopes", () => {
  it("requests Calendar read access with the base Supabase Google sign-in", () => {
    const scopes = GOOGLE_CALENDAR_AUTH_SCOPES.split(/\s+/);

    expect(scopes).toEqual(
      expect.arrayContaining([
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.readonly",
      ]),
    );
  });
});
