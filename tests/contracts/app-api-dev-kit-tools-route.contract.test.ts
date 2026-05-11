import { describe, expect, it } from "vitest";
import { apiRouteContracts, getRouteSmokeCase } from "../api/route-contracts";

const contract = apiRouteContracts.find((item) => item.route === "/api/dev-kit/tools");

describe("app/api/dev-kit/tools/route.ts request and response contract", () => {
  it("is registered as a DevKit inventory route", () => {
    expect(contract).toBeDefined();
    expect(contract?.file).toBe("app/api/dev-kit/tools/route.ts");
    expect(contract?.methods).toEqual(["GET"]);
    expect(contract?.auth).toBe("dev-kit");
    expect(contract?.requiresRequestId).toBe(false);
    expect(contract?.assertJson).toBe(true);
  });

  it("has a read-only smoke contract for dashboard proof", () => {
    expect(contract).toBeDefined();
    const smoke = getRouteSmokeCase(contract!, "GET");

    expect(contract?.smokePath).toBe("/api/dev-kit/tools");
    expect(smoke.expectStatuses).toEqual([200, 401, 403, 404, 503]);
    expect(smoke.assertJson).toBe(true);
    expect(smoke.requiresRequestId).toBe(false);
  });
});
