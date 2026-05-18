import { POST } from "@/app/api/dev-kit/config/[name]/route";
import { NextRequest } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/dev-kit/config/budget", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("app/api/dev-kit/config/[name]/route.ts integration behavior", () => {
  beforeEach(() => {
    vi.mocked(mkdirSync).mockClear();
    vi.mocked(writeFileSync).mockClear();
  });

  it("writes an allowlisted config slug", async () => {
    const response = await POST(request({ yaml: "limits:\n  dailyUsd: 25\n" }), {
      params: Promise.resolve({ name: "budget" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      path: ".ai-dev-kit/budget.yaml",
    });
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(".ai-dev-kit/budget.yaml"),
      "limits:\n  dailyUsd: 25\n",
      "utf-8",
    );
  });

  it("rejects slugs outside the editable allowlist", async () => {
    const response = await POST(request({ yaml: "value: true\n" }), {
      params: Promise.resolve({ name: "not-allowed" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      error: "not_found",
      message: "unknown config slug: not-allowed",
    });
    expect(writeFileSync).not.toHaveBeenCalled();
  });
});
