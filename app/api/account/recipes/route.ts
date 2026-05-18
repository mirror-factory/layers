/**
 * GET  /api/account/recipes  — list signed-in user's recipes
 * POST /api/account/recipes  — create a recipe
 *
 * PROD-463. Companion route at `[id]/route.ts` for PATCH + DELETE.
 *
 * RLS: `recipes` table has RLS enabled but no anon/auth policies; all reads
 * and writes go through this route via `getSupabaseServer()` (service role)
 * scoped by the caller's user_id.
 *
 * First-time users get the 5 STARTER_RECIPES seeded lazily on their
 * inaugural GET — see `lib/recipes/store.ts:listRecipes`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { getCurrentUserId } from "@/lib/supabase/user";
import { listRecipes, createRecipe } from "@/lib/recipes/store";
import { recipeCreateSchema } from "@/lib/recipes/types";

export const GET = withRoute(async () => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign-in required" },
      { status: 401 },
    );
  }

  const recipes = await listRecipes(userId);
  return NextResponse.json({ recipes });
});

export const POST = withRoute(async (req) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign-in required" },
      { status: 401 },
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

  const parsed = recipeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const recipe = await createRecipe(userId, parsed.data);
  return NextResponse.json({ recipe }, { status: 201 });
});
