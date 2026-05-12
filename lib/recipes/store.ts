/**
 * Server-side Recipes store (PROD-463).
 *
 * All reads/writes route through the service-role Supabase client and
 * scope queries by the caller's user_id — the `recipes` table has RLS
 * enabled but no anon/auth policies, so service-role bypass is the only
 * legitimate access path.
 *
 * New users get a lazy starter-recipe seed on their first GET — if the
 * count of their recipes is zero we insert the STARTER_RECIPES set in a
 * single batch insert. After that this function is a no-op for them.
 */

import { getSupabaseServer } from "@/lib/supabase/server";
import type { Recipe, RecipeCreate, RecipeUpdate } from "./types";
import { STARTER_RECIPES } from "./starter";

interface SupabaseRecipeRow {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

function rowToRecipe(row: SupabaseRecipeRow): Recipe {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    prompt: row.prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRecipes(userId: string): Promise<Recipe[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("recipes")
    .select("id, user_id, name, prompt, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to list recipes: ${error.message}`);

  const rows = (data ?? []) as SupabaseRecipeRow[];

  if (rows.length === 0) {
    return await seedStarterRecipes(userId);
  }

  return rows.map(rowToRecipe);
}

export async function createRecipe(
  userId: string,
  input: RecipeCreate,
): Promise<Recipe> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("Storage is not configured");

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      name: input.name,
      prompt: input.prompt,
    })
    .select("id, user_id, name, prompt, created_at, updated_at")
    .single();

  if (error) throw new Error(`Failed to create recipe: ${error.message}`);
  return rowToRecipe(data as SupabaseRecipeRow);
}

export async function updateRecipe(
  userId: string,
  id: string,
  patch: RecipeUpdate,
): Promise<Recipe | null> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("Storage is not configured");

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.prompt !== undefined) updates.prompt = patch.prompt;

  const { data, error } = await supabase
    .from("recipes")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, user_id, name, prompt, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(`Failed to update recipe: ${error.message}`);
  if (!data) return null;
  return rowToRecipe(data as SupabaseRecipeRow);
}

export async function deleteRecipe(
  userId: string,
  id: string,
): Promise<boolean> {
  const supabase = getSupabaseServer();
  if (!supabase) throw new Error("Storage is not configured");

  const { error, count } = await supabase
    .from("recipes")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete recipe: ${error.message}`);
  return (count ?? 0) > 0;
}

async function seedStarterRecipes(userId: string): Promise<Recipe[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const rowsToInsert = STARTER_RECIPES.map((r) => ({
    user_id: userId,
    name: r.name,
    prompt: r.prompt,
  }));

  const { data, error } = await supabase
    .from("recipes")
    .insert(rowsToInsert)
    .select("id, user_id, name, prompt, created_at, updated_at");

  if (error) {
    // Seed failure shouldn't block the GET — return what we tried to seed,
    // logged but not thrown.
    console.warn("Failed to seed starter recipes:", error.message);
    return [];
  }

  return ((data ?? []) as SupabaseRecipeRow[]).map(rowToRecipe);
}
