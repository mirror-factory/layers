import { apiRouteContracts } from "@/tests/api/route-contracts";
import { describe, expect, it } from "vitest";

describe("app/api/dev-kit/config/route.ts request and response contract", () => {
  it("is registered as a dev-kit JSON GET route", () => {
    const contract = apiRouteContracts.find(
      (candidate) => candidate.file === "app/api/dev-kit/config/route.ts",
    );

    expect(contract).toMatchObject({
      route: "/api/dev-kit/config",
      smokePath: "/api/dev-kit/config",
      methods: ["GET"],
      auth: "dev-kit",
      assertJson: true,
      requiresRequestId: false,
    });
  });
});
