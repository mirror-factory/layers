/**
 * Per-process in-memory cache for completed summaries.
 *
 * Keyed by AssemblyAI transcript id. Lives in the Node.js runtime and is
 * lost on redeploy — acceptable for V1. Production should move this to
 * Supabase (meetings table) so summaries survive restarts and can be
 * queried across sessions.
 */

import type { MeetingSummary } from "./schema";

const MAX_ENTRIES = 500;
const store = new Map<string, MeetingSummary>();

export function cacheSummary(id: string, summary: MeetingSummary): void {
  if (store.size >= MAX_ENTRIES) {
    // FIFO eviction: drop the oldest entry (insertion order is preserved).
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(id, summary);
}

export function getCachedSummary(id: string): MeetingSummary | undefined {
  return store.get(id);
}

export function __clearSummaryCache(): void {
  store.clear();
}

export function __summaryCacheSize(): number {
  return store.size;
}
