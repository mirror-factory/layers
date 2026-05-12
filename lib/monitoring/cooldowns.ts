/**
 * Per-condition alert cooldown (PROD-371).
 *
 * The watchlist tick runs every 5 minutes; if a condition stays tripped for
 * 30 minutes we don't want to fire 6 Slack messages about it. The cooldown
 * window is 15 minutes by default — after we fire for a key, we suppress
 * further alerts on the same key until the cooldown expires.
 *
 * Storage model:
 *   - Default: process-local Map. Lives until next deploy / cold start.
 *     Acceptable for a 10-user alpha; the cron only runs in one region.
 *   - Pluggable via `setCooldownStore()` for future persistence (e.g. a
 *     Supabase `alert_cooldowns` table). Keeps the call sites unchanged.
 */

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;

export interface CooldownStore {
  /** Last-fired timestamp for `key`, or null/undefined when none. */
  get(key: string): number | undefined | null | Promise<number | undefined | null>;
  set(key: string, ts: number): void | Promise<void>;
  /** Test helper. Implementations may make this a no-op in production. */
  clear?(): void | Promise<void>;
}

class MemoryCooldownStore implements CooldownStore {
  private readonly map = new Map<string, number>();
  get(key: string) { return this.map.get(key); }
  set(key: string, ts: number) { this.map.set(key, ts); }
  clear() { this.map.clear(); }
}

let store: CooldownStore = new MemoryCooldownStore();

export function setCooldownStore(next: CooldownStore): void {
  store = next;
}

export function getCooldownStore(): CooldownStore {
  return store;
}

/**
 * Returns true when the key was last fired within `cooldownMs` of `now`.
 */
export async function isCoolingDown(
  key: string,
  now: number = Date.now(),
  cooldownMs: number = DEFAULT_COOLDOWN_MS,
): Promise<boolean> {
  const last = await store.get(key);
  if (typeof last !== 'number') return false;
  return now - last < cooldownMs;
}

/**
 * Record that we fired an alert for `key` at `now`. Subsequent checks within
 * the cooldown window return true from `isCoolingDown`.
 */
export async function markFired(
  key: string,
  now: number = Date.now(),
): Promise<void> {
  await store.set(key, now);
}

export const COOLDOWN_DEFAULTS = {
  cooldownMs: DEFAULT_COOLDOWN_MS,
};

/**
 * Test helper — reset the in-memory store.
 */
export function __resetCooldownsForTests(): void {
  if (store.clear) {
    void store.clear();
  } else {
    store = new MemoryCooldownStore();
  }
}
