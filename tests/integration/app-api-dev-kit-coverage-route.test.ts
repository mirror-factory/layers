import { GET } from "@/app/api/dev-kit/coverage/route";
import { describe, expect, it, vi } from "vitest";

describe("app/api/dev-kit/coverage/route.ts integration behavior", () => {
  it("returns local registry coverage when Supabase is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      source: "local-tools-registry",
    });
    expect(Array.isArray(body.coverage)).toBe(true);
    expect(body.coverage.length).toBeGreaterThan(0);
    expect(body.coverage[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        category: expect.any(String),
        hasUnitTests: expect.any(Boolean),
        hasEvalCases: expect.any(Boolean),
      }),
    );

    vi.unstubAllEnvs();
  });
});
