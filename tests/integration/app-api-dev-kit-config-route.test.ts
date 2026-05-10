import { GET } from "@/app/api/dev-kit/config/route";
import { describe, expect, it } from "vitest";

describe("app/api/dev-kit/config/route.ts integration behavior", () => {
  it("returns editable DevKit config files with stable metadata", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.files)).toBe(true);
    expect(body.files.length).toBeGreaterThan(0);
    expect(body.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "design-tokens",
          path: ".ai-dev-kit/registries/design-tokens.yaml",
          label: "Design tokens",
          exists: true,
          content: expect.any(String),
          bytes: expect.any(Number),
        }),
      ]),
    );
  });
});
