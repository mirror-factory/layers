import { POST } from "@/app/api/dev-kit/config/[name]/route";
import { apiRouteContracts } from "@/tests/api/route-contracts";
import { NextRequest } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/dev-kit/config/design-tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("app/api/dev-kit/config/[name]/route.ts request and response contract", () => {
  it("is registered as a dev-kit JSON POST route using the yaml body alias", () => {
    const contract = apiRouteContracts.find(
      (candidate) => candidate.file === "app/api/dev-kit/config/[name]/route.ts",
    );

    expect(contract).toMatchObject({
      route: "/api/dev-kit/config/[name]",
      smokePath: "/api/dev-kit/config/design-tokens",
      methods: ["POST"],
      auth: "dev-kit",
      assertJson: true,
      requiresRequestId: false,
    });
    expect(contract?.smoke?.POST?.body).toEqual({ yaml: "colors: {}\n" });
  });

  it("accepts { yaml } and returns the stable save response shape", async () => {
    const response = await POST(request({ yaml: "colors: {}\n" }), {
      params: Promise.resolve({ name: "design-tokens" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      bytes: 11,
      path: ".ai-dev-kit/registries/design-tokens.yaml",
    });
    expect(mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(".ai-dev-kit/registries"),
      { recursive: true },
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(".ai-dev-kit/registries/design-tokens.yaml"),
      "colors: {}\n",
      "utf-8",
    );
  });

  it("keeps { content } compatibility for the dashboard editor", async () => {
    const response = await POST(request({ content: "colors: {}\n" }), {
      params: Promise.resolve({ name: "design-tokens" }),
    });

    expect(response.status).toBe(200);
  });

  it("returns a JSON validation error when neither content nor yaml is a string", async () => {
    const response = await POST(request({}), {
      params: Promise.resolve({ name: "design-tokens" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: "invalid_body",
      message: "`content` or `yaml` must be a string",
    });
  });
});
