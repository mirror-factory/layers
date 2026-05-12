/**
 * Recipe — a saved chat prompt the user can recall with `/` in the chat
 * input. PROD-463.
 */

import { z } from "zod";

export interface Recipe {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

export const recipeCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(2000),
});

export const recipeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  prompt: z.string().trim().min(1).max(2000).optional(),
}).refine(
  (data) => data.name !== undefined || data.prompt !== undefined,
  { message: "Provide at least one field to update" },
);

export type RecipeCreate = z.infer<typeof recipeCreateSchema>;
export type RecipeUpdate = z.infer<typeof recipeUpdateSchema>;
