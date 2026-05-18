import { describe, expect, it } from "vitest";
import {
  recipeCreateSchema,
  recipeUpdateSchema,
} from "@/lib/recipes/types";
import { STARTER_RECIPES } from "@/lib/recipes/starter";

describe("recipes types (PROD-463)", () => {
  describe("recipeCreateSchema", () => {
    it("accepts a well-formed recipe", () => {
      const result = recipeCreateSchema.safeParse({
        name: "Sales discovery",
        prompt: "Summarize as a sales discovery brief with pain points...",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const r = recipeCreateSchema.safeParse({ name: "", prompt: "x" });
      expect(r.success).toBe(false);
    });

    it("rejects empty prompt", () => {
      const r = recipeCreateSchema.safeParse({ name: "x", prompt: "" });
      expect(r.success).toBe(false);
    });

    it("trims whitespace and rejects whitespace-only inputs", () => {
      const r = recipeCreateSchema.safeParse({
        name: "   ",
        prompt: "Anything",
      });
      expect(r.success).toBe(false);
    });

    it("enforces the 80-char name cap", () => {
      const r = recipeCreateSchema.safeParse({
        name: "a".repeat(81),
        prompt: "x",
      });
      expect(r.success).toBe(false);
    });

    it("enforces the 2000-char prompt cap", () => {
      const r = recipeCreateSchema.safeParse({
        name: "Long",
        prompt: "x".repeat(2001),
      });
      expect(r.success).toBe(false);
    });
  });

  describe("recipeUpdateSchema", () => {
    it("accepts a name-only update", () => {
      const r = recipeUpdateSchema.safeParse({ name: "Renamed" });
      expect(r.success).toBe(true);
    });

    it("accepts a prompt-only update", () => {
      const r = recipeUpdateSchema.safeParse({ prompt: "Different prompt" });
      expect(r.success).toBe(true);
    });

    it("accepts both fields", () => {
      const r = recipeUpdateSchema.safeParse({
        name: "Renamed",
        prompt: "Different prompt",
      });
      expect(r.success).toBe(true);
    });

    it("rejects an empty body — must provide at least one field", () => {
      const r = recipeUpdateSchema.safeParse({});
      expect(r.success).toBe(false);
    });
  });

  describe("STARTER_RECIPES", () => {
    it("has exactly 5 starter recipes (the legacy template set)", () => {
      expect(STARTER_RECIPES).toHaveLength(5);
    });

    it("covers the 5 names users will recognise from before the refactor", () => {
      const names = STARTER_RECIPES.map((r) => r.name);
      expect(names).toEqual([
        "Sales discovery",
        "Interview debrief",
        "Standup summary",
        "Follow-up email",
        "Intake record",
      ]);
    });

    it("every starter recipe validates against the create schema", () => {
      for (const recipe of STARTER_RECIPES) {
        const r = recipeCreateSchema.safeParse(recipe);
        expect(r.success, `${recipe.name} should validate`).toBe(true);
      }
    });
  });
});
