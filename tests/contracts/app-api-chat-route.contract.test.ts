import { describe, expect, it } from "vitest";
import { apiRouteContracts, getRouteSmokeCase } from "../api/route-contracts";

const contract = apiRouteContracts.find((item) => item.route === "/api/chat");

describe("app/api/chat/route.ts request and response contract", () => {
  it("is registered as an authenticated POST chat route", () => {
    expect(contract).toBeDefined();
    expect(contract?.file).toBe("app/api/chat/route.ts");
    expect(contract?.methods).toEqual(["POST"]);
    expect(contract?.auth).toBe("user");
    expect(contract?.requiresRequestId).toBe(true);
    expect(contract?.assertJson).toBe(true);
  });

  it("keeps a safe smoke case for empty messages", () => {
    expect(contract).toBeDefined();
    const smoke = getRouteSmokeCase(contract!, "POST");

    expect(contract?.smokePath).toBe("/api/chat");
    expect(smoke.body).toEqual({ messages: [] });
    expect(smoke.expectStatuses).toEqual([200, 400, 401, 503]);
    expect(smoke.assertJson).toBe(true);
    expect(smoke.requiresRequestId).toBe(true);
  });
});
