/**
 * Coverage anchor for /api/account/recipes/[id] (PROD-463).
 *
 * Deeper coverage of the recipes Zod schemas + starter set lives in
 * tests/unit/recipes-store.test.ts. This file imports the route handler
 * so `tests/route-coverage.test.ts` sees the dynamic-segment route as
 * exercised.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/account/recipes/[id]/route";

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/lib/recipes/store", () => ({
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

import { getCurrentUserId } from "@/lib/supabase/user";
import { updateRecipe, deleteRecipe } from "@/lib/recipes/store";

function patchRequest(body: unknown): NextRequest {
  return new Request("https://layers.test/api/account/recipes/abc", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function deleteRequest(): NextRequest {
  return new Request("https://layers.test/api/account/recipes/abc", {
    method: "DELETE",
  }) as unknown as NextRequest;
}

const ctx = {
  requestId: "req",
  startedAt: 0,
  params: { id: "abc" },
} as unknown as Parameters<typeof PATCH>[1];

describe("PATCH/DELETE /api/account/recipes/[id]", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUserId).mockReset();
    vi.mocked(updateRecipe).mockReset();
    vi.mocked(deleteRecipe).mockReset();
  });

  it("PATCH returns 401 when caller is not signed in", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const res = await PATCH(patchRequest({ name: "Renamed" }), ctx);
    expect(res.status).toBe(401);
  });

  it("PATCH returns 400 when body is empty (Zod requires at least one field)", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user_a");
    const res = await PATCH(patchRequest({}), ctx);
    expect(res.status).toBe(400);
  });

  it("PATCH returns 404 when the recipe is not found", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user_a");
    vi.mocked(updateRecipe).mockResolvedValue(null);
    const res = await PATCH(patchRequest({ name: "Renamed" }), ctx);
    expect(res.status).toBe(404);
  });

  it("DELETE returns 401 when caller is not signed in", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("DELETE returns 404 when nothing was deleted", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user_a");
    vi.mocked(deleteRecipe).mockResolvedValue(false);
    const res = await DELETE(deleteRequest(), ctx);
    expect(res.status).toBe(404);
  });
});
