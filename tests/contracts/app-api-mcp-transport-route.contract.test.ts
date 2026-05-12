import { describe, expect, it } from "vitest";
import { apiRouteContracts, getRouteSmokeCase } from "../api/route-contracts";

const contract = apiRouteContracts.find((item) => item.route === "/api/mcp/[transport]");

describe("app/api/mcp/[transport]/route.ts request and response contract", () => {
  it("is registered as the bearer-protected MCP transport route", () => {
    expect(contract).toBeDefined();
    expect(contract?.file).toBe("app/api/mcp/[transport]/route.ts");
    expect(contract?.methods).toEqual(["GET", "POST", "DELETE"]);
    expect(contract?.auth).toBe("mcp-bearer");
    expect(contract?.smokePath).toBe("/api/mcp/mcp");
    expect(contract?.assertJson).toBe(false);
  });

  it("documents the initialize smoke request without requiring JSON responses", () => {
    expect(contract).toBeDefined();
    const postSmoke = getRouteSmokeCase(contract!, "POST");
    const deleteSmoke = getRouteSmokeCase(contract!, "DELETE");

    expect(postSmoke.body).toEqual({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(postSmoke.headers).toEqual({ accept: "application/json, text/event-stream" });
    expect(postSmoke.assertJson).toBe(false);
    expect(postSmoke.expectStatuses).toEqual([200, 400, 401, 404]);
    expect(deleteSmoke.assertJson).toBe(false);
  });
});
