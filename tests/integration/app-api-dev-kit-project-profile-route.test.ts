import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/dev-kit/project-profile/route";

describe("app/api/dev-kit/project-profile/route.ts integration behavior", () => {
  it("returns the project harness report", async () => {
    const path = ["api", "dev-kit", "project-profile"].join("/");
    const response = await GET(new NextRequest(`http://localhost/${path}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project.id).toBe("layers");
    expect(body.pass).toBe(true);
    expect(body.checks.some((check: { id?: string }) => check.id === "dashboard.proof")).toBe(true);
  });
});
