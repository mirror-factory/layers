/**
 * PROD-371 -- cooldown store unit tests.
 *
 * Defaults are intentionally small (in-memory, per-process). These tests
 * pin the contract any future store (Supabase, Redis) must obey:
 *   - isCoolingDown returns false until markFired is called
 *   - within the window: cooling
 *   - after the window: not cooling
 *   - reset helper clears state
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  isCoolingDown,
  markFired,
  __resetCooldownsForTests,
  COOLDOWN_DEFAULTS,
} from '@/lib/monitoring/cooldowns';

afterEach(() => {
  __resetCooldownsForTests();
});

describe('lib/monitoring/cooldowns', () => {
  it('returns false when the key has never fired', async () => {
    await expect(isCoolingDown('never-fired')).resolves.toBe(false);
  });

  it('returns true within the cooldown window', async () => {
    const t0 = 1_700_000_000_000;
    await markFired('spend_over_cap', t0);
    await expect(isCoolingDown('spend_over_cap', t0 + 60_000)).resolves.toBe(true);
  });

  it('returns false once the cooldown window lapses', async () => {
    const t0 = 1_700_000_000_000;
    await markFired('spend_over_cap', t0);
    await expect(
      isCoolingDown('spend_over_cap', t0 + COOLDOWN_DEFAULTS.cooldownMs + 1),
    ).resolves.toBe(false);
  });

  it('treats keys as independent', async () => {
    const t0 = 1_700_000_000_000;
    await markFired('error_rate_over_threshold', t0);
    await expect(isCoolingDown('error_rate_over_threshold', t0)).resolves.toBe(true);
    await expect(isCoolingDown('spend_over_cap', t0)).resolves.toBe(false);
  });

  it('respects an explicit cooldownMs override', async () => {
    const t0 = 1_700_000_000_000;
    await markFired('k', t0);
    await expect(isCoolingDown('k', t0 + 1_000, 500)).resolves.toBe(false);
    await expect(isCoolingDown('k', t0 + 200, 500)).resolves.toBe(true);
  });
});
