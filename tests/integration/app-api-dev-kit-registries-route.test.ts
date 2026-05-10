import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/dev-kit/registries/route";

type RegistryResponse = {
  registries: Array<{
    vendor?: string;
    label?: string;
    ageDays?: number | null;
    stale?: boolean;
  }>;
};

describe("app/api/dev-kit/registries/route.ts integration behavior", () => {
  it("returns only displayable vendor registries", async () => {
    const response = await GET(new NextRequest("http://localhost/api/dev-kit/registries"));
    const body = (await response.json()) as RegistryResponse;

    expect(response.status).toBe(200);
    expect(body.registries.length).toBeGreaterThan(0);

    const vendors = body.registries.map(reg => reg.vendor);
    expect(vendors).toContain("assemblyai");
    expect(vendors).not.toContain("feature-proof");
    expect(vendors).not.toContain(undefined);

    for (const registry of body.registries) {
      expect(registry.vendor?.trim().length).toBeGreaterThan(0);
      expect((registry.label ?? registry.vendor)?.trim().length).toBeGreaterThan(0);
      expect(
        registry.ageDays === null || typeof registry.ageDays === "number",
        `${registry.vendor ?? "unknown"} has displayable age metadata`,
      ).toBe(true);
      expect(typeof registry.stale).toBe("boolean");
    }
  });
});
