import { apiRouteContracts } from "@/tests/api/route-contracts";
import { describe, expect, it } from "vitest";

describe("app/api/dev-kit/coverage/route.ts request and response contract", () => {
  it("is registered as a dev-kit JSON GET route", () => {
    const contract = apiRouteContracts.find(
      (candidate) => candidate.file === "app/api/dev-kit/coverage/route.ts",
    );

    expect(contract).toMatchObject({
      route: "/api/dev-kit/coverage",
      smokePath: "/api/dev-kit/coverage",
      methods: ["GET"],
      auth: "dev-kit",
      assertJson: true,
      requiresRequestId: false,
    });
  });
});
