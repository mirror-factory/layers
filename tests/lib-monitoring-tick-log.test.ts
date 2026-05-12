/**
 * PROD-371 -- rolling 24h tick log unit tests.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  appendTickLog,
  listTickLog,
  listFiredTickLog,
  __resetTickLogForTests,
} from '@/lib/monitoring/tick-log';

afterEach(() => {
  __resetTickLogForTests();
});

const t0 = 1_700_000_000_000;
const isoAt = (offsetMs: number) => new Date(t0 + offsetMs).toISOString();

describe('lib/monitoring/tick-log', () => {
  it('appends and lists entries within the 24h window', () => {
    appendTickLog({
      ts: isoAt(0),
      firedIds: ['spend_over_cap'],
      suppressedIds: [],
      webhookConfigured: false,
    }, t0);

    const entries = listTickLog(t0);
    expect(entries).toHaveLength(1);
    expect(entries[0].firedIds).toEqual(['spend_over_cap']);
  });

  it('drops entries older than 24h', () => {
    appendTickLog({
      ts: isoAt(-25 * 60 * 60 * 1000),
      firedIds: [],
      suppressedIds: [],
      webhookConfigured: false,
    }, t0);
    // Trim happens on append; insert a fresh one to trigger it.
    appendTickLog({
      ts: isoAt(0),
      firedIds: [],
      suppressedIds: [],
      webhookConfigured: false,
    }, t0);
    expect(listTickLog(t0)).toHaveLength(1);
  });

  it('listFiredTickLog filters out no-op ticks', () => {
    appendTickLog({
      ts: isoAt(0),
      firedIds: [],
      suppressedIds: [],
      webhookConfigured: false,
    }, t0);
    appendTickLog({
      ts: isoAt(1_000),
      firedIds: ['error_rate_over_threshold'],
      suppressedIds: [],
      webhookConfigured: true,
      webhookOk: true,
    }, t0);
    const fired = listFiredTickLog(t0);
    expect(fired).toHaveLength(1);
    expect(fired[0].firedIds).toEqual(['error_rate_over_threshold']);
  });
});
