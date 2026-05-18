"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send } from "lucide-react";
import type { Recipe } from "@/lib/recipes/types";
import { STARTER_RECIPES } from "@/lib/recipes/starter";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

type RecipeOption = Pick<Recipe, "name" | "prompt"> & { id?: string };

const SLASH_TRIGGER_REGEX = /^\/([^\n]*)$/;

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask about your meetings...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [recipes, setRecipes] = useState<RecipeOption[] | null>(null);
  const [recipeMenuOpen, setRecipeMenuOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Lazy-load the user's Recipes when the slash trigger first opens. If the
  // user has none yet, the API seeds STARTER_RECIPES on the server. We also
  // fall back to STARTER_RECIPES locally if the fetch fails, so the slash
  // menu still works for unauthenticated previews.
  useEffect(() => {
    if (!recipeMenuOpen || recipes !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/recipes", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { recipes: RecipeOption[] };
        if (!cancelled) {
          setRecipes(data.recipes ?? []);
        }
      } catch {
        if (!cancelled) {
          setRecipes(
            STARTER_RECIPES.map((r) => ({ name: r.name, prompt: r.prompt })),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeMenuOpen, recipes]);

  const slashMatch = SLASH_TRIGGER_REGEX.exec(value);
  const slashFilter =
    recipeMenuOpen && slashMatch ? slashMatch[1].toLowerCase().trim() : "";
  const filteredRecipes = recipes
    ? recipes.filter((r) =>
        slashFilter.length === 0
          ? true
          : r.name.toLowerCase().includes(slashFilter) ||
            r.prompt.toLowerCase().includes(slashFilter),
      )
    : [];

  // Keep the menu open as long as the input starts with `/`.
  useEffect(() => {
    const shouldBeOpen = SLASH_TRIGGER_REGEX.test(value);
    setRecipeMenuOpen(shouldBeOpen);
    if (!shouldBeOpen) setHighlightIndex(0);
  }, [value]);

  // Keep the highlight in bounds when the filtered list shrinks.
  useEffect(() => {
    if (highlightIndex >= filteredRecipes.length) {
      setHighlightIndex(Math.max(0, filteredRecipes.length - 1));
    }
  }, [filteredRecipes.length, highlightIndex]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    if (recipeMenuOpen) return; // Enter inside the menu picks; outside sends.
    onSend(trimmed);
    setValue("");
  }, [value, disabled, onSend, recipeMenuOpen]);

  const insertRecipe = useCallback(
    (recipe: RecipeOption) => {
      setValue(recipe.prompt);
      setRecipeMenuOpen(false);
      // Defer focus so React commits the state update first.
      queueMicrotask(() => textareaRef.current?.focus());
    },
    [],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (recipeMenuOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        setRecipeMenuOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) =>
          filteredRecipes.length > 0 ? (i + 1) % filteredRecipes.length : 0,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) =>
          filteredRecipes.length > 0
            ? (i - 1 + filteredRecipes.length) % filteredRecipes.length
            : 0,
        );
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const recipe = filteredRecipes[highlightIndex];
        if (recipe) {
          e.preventDefault();
          insertRecipe(recipe);
          return;
        }
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="signal-panel relative rounded-lg p-3"
      style={{ paddingBottom: "calc(0.75rem + var(--safe-bottom))" }}
    >
      {recipeMenuOpen && filteredRecipes.length > 0 ? (
        <div
          role="listbox"
          aria-label="Insert a recipe"
          className="absolute bottom-full left-3 right-3 mb-2 max-h-72 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] shadow-lg"
        >
          {filteredRecipes.map((r, i) => (
            <button
              key={r.id ?? `${r.name}-${i}`}
              type="button"
              role="option"
              aria-selected={i === highlightIndex}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                insertRecipe(r);
              }}
              className={`block w-full px-3 py-2 text-left transition-colors ${
                i === highlightIndex
                  ? "bg-layers-mint/15 text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
              }`}
            >
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {r.name}
              </div>
              <div className="line-clamp-1 text-xs text-[var(--text-muted)]">
                {r.prompt}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="signal-input min-h-[44px] flex-1 resize-none rounded-md px-3 py-2.5 text-sm leading-6 text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors duration-200 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-md bg-layers-mint text-layers-ink transition-colors duration-200 hover:bg-layers-mint-soft disabled:opacity-30 disabled:hover:bg-layers-mint"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
