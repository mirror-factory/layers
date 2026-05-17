import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/dev-kit/proof/route";

describe("app/api/dev-kit/proof/route.ts integration behavior", () => {
  it("returns the latest proof packet state", async () => {
    const path = ["api", "dev-kit", "proof"].join("/");
    const response = await GET(new NextRequest(`http://localhost/${path}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(typeof body.present).toBe("boolean");
    expect(body.path).toContain(".evidence/proof-packet.json");
  });
});
