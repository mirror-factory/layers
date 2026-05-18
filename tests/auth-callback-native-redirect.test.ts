import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/auth/callback/route";

describe("app/auth/callback native redirect", () => {
  it("bounces native OAuth callbacks from HTTPS back to the custom scheme", async () => {
    const response = await GET(
      new NextRequest(
        "https://layers.mirrorfactory.ai/auth/callback?native=1&next=%2Frecord&code=oauth-code&state=state-1",
      ),
    );

    const location = response.headers.get("location");
    expect(response.status).toBe(302);
    expect(location).toBe(
      "com.mirafactory.layers://auth/callback?code=oauth-code&state=state-1&next=%2Frecord",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("preserves OAuth errors for the native app and sanitizes external next values", async () => {
    const response = await GET(
      new NextRequest(
        "https://layers.mirrorfactory.ai/auth/callback?native=1&next=%2F%2Fevil.test&error=access_denied&error_description=Denied",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "com.mirafactory.layers://auth/callback?error=access_denied&error_description=Denied&next=%2Frecord",
    );
  });
});
