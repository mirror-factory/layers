import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALENDAR_AUTH_SCOPES,
  GOOGLE_SIGN_IN_AUTH_SCOPES,
} from "@/lib/auth/google-oauth";

describe("Google OAuth scopes", () => {
  it("keeps base Supabase Google sign-in limited to identity scopes", () => {
    const scopes = GOOGLE_SIGN_IN_AUTH_SCOPES.split(/\s+/);

    expect(scopes).toEqual(["openid", "email", "profile"]);
    expect(scopes).not.toContain("https://www.googleapis.com/auth/calendar.readonly");
  });

  it("requests Calendar read access only in the calendar connect flow", () => {
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
