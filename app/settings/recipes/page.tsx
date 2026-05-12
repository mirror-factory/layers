"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import type { Recipe } from "@/lib/recipes/types";

export default function RecipesSettingsPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/recipes", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { recipes: Recipe[] };
      setRecipes(data.recipes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async () => {
    const name = newName.trim();
    const prompt = newPrompt.trim();
    if (!name || !prompt) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/account/recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, prompt }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { recipe: Recipe };
      setRecipes((prev) => [data.recipe, ...prev]);
      setNewName("");
      setNewPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create recipe");
    } finally {
      setCreating(false);
    }
  }, [newName, newPrompt]);

  const remove = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/account/recipes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete recipe");
    }
  }, []);

  const update = useCallback(
    async (id: string, patch: { name?: string; prompt?: string }) => {
      try {
        const res = await fetch(`/api/account/recipes/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { recipe: Recipe };
        setRecipes((prev) =>
          prev.map((r) => (r.id === id ? data.recipe : r)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update recipe");
      }
    },
    [],
  );

  return (
    <div
      className="paper-calm-page min-h-screen-safe flex flex-col"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <TopBar title="Recipes" showBack />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-medium text-[var(--text-primary)]">
            Recipes
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Save prompts you use often. Type{" "}
            <kbd className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-xs">
              /
            </kbd>{" "}
            in any chat to insert one.
          </p>
        </header>

        <section className="signal-panel space-y-3 rounded-lg p-4">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            New recipe
          </h2>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Customer interview)"
            className="signal-input w-full rounded-md px-3 py-2 text-sm"
            maxLength={80}
          />
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="Prompt the AI will run when you insert this recipe"
            rows={4}
            className="signal-input w-full resize-y rounded-md px-3 py-2 text-sm"
            maxLength={2000}
          />
          <button
            type="button"
            onClick={create}
            disabled={creating || !newName.trim() || !newPrompt.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-layers-mint px-3 py-2 text-sm font-medium text-layers-ink transition-colors hover:bg-layers-mint-soft disabled:opacity-50"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Save recipe
          </button>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-400/40 bg-red-50/40 px-3 py-2 text-sm text-red-900"
          >
            {error}
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            Your recipes
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No recipes yet. Create your first above.
            </p>
          ) : (
            <ul className="space-y-2">
              {recipes.map((r) => (
                <li
                  key={r.id}
                  className="signal-panel rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <input
                      type="text"
                      defaultValue={r.name}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== r.name) {
                          void update(r.id, { name: next });
                        }
                      }}
                      maxLength={80}
                      className="signal-input flex-1 rounded-md px-2 py-1 text-sm font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-red-100 hover:text-red-700"
                      aria-label={`Delete recipe ${r.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea
                    defaultValue={r.prompt}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== r.prompt) {
                        void update(r.id, { prompt: next });
                      }
                    }}
                    rows={3}
                    maxLength={2000}
                    className="signal-input mt-2 w-full resize-y rounded-md px-2 py-1.5 text-xs leading-5"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
