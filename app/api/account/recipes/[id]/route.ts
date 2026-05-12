/**
 * PATCH  /api/account/recipes/[id]  — update name and/or prompt
 * DELETE /api/account/recipes/[id]  — delete (RLS-scoped to caller)
 *
 * PROD-463.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { getCurrentUserId } from "@/lib/supabase/user";
import { updateRecipe, deleteRecipe } from "@/lib/recipes/store";
import { recipeUpdateSchema } from "@/lib/recipes/types";

function recipeIdFromParams(
  params: unknown,
): string | null {
  if (!params || typeof params !== "object") return null;
  const p = params as { id?: unknown };
  return typeof p.id === "string" ? p.id : null;
}

export const PATCH = withRoute(async (req, ctx) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign-in required" },
      { status: 401 },
    );
  }

  const id = recipeIdFromParams(ctx.params);
  if (!id) {
    return NextResponse.json(
      { error: "Missing recipe id" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = recipeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const recipe = await updateRecipe(userId, id, parsed.data);
  if (!recipe) {
    return NextResponse.json(
      { error: "Recipe not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ recipe });
});

export const DELETE = withRoute(async (_req, ctx) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign-in required" },
      { status: 401 },
    );
  }

  const id = recipeIdFromParams(ctx.params);
  if (!id) {
    return NextResponse.json(
      { error: "Missing recipe id" },
      { status: 400 },
    );
  }

  const ok = await deleteRecipe(userId, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Recipe not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
});
