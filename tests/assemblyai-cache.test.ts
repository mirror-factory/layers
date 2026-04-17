/**
 * In-memory summary cache tests.
 *
 * Covers idempotent writes, read-through, FIFO eviction at the cap, and
 * isolation between keys.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  cacheSummary,
  getCachedSummary,
  __clearSummaryCache,
  __summaryCacheSize,
} from "@/lib/assemblyai/cache";
import type { MeetingSummary } from "@/lib/assemblyai/schema";

function mockSummary(tag: string): MeetingSummary {
  return {
    summary: `summary ${tag}`,
    keyPoints: [],
    actionItems: [],
    decisions: [],
    participants: [],
  };
}

describe("summary cache", () => {
  beforeEach(() => {
    __clearSummaryCache();
  });

  it("returns undefined for missing keys", () => {
    expect(getCachedSummary("nope")).toBeUndefined();
  });

  it("round-trips a summary by id", () => {
    const s = mockSummary("1");
    cacheSummary("tr-1", s);
    expect(getCachedSummary("tr-1")).toEqual(s);
  });

  it("overwrites an existing key in place", () => {
    cacheSummary("tr-1", mockSummary("v1"));
    cacheSummary("tr-1", mockSummary("v2"));
    expect(getCachedSummary("tr-1")?.summary).toBe("summary v2");
    expect(__summaryCacheSize()).toBe(1);
  });

  it("isolates different ids", () => {
    cacheSummary("a", mockSummary("A"));
    cacheSummary("b", mockSummary("B"));
    expect(getCachedSummary("a")?.summary).toBe("summary A");
    expect(getCachedSummary("b")?.summary).toBe("summary B");
  });

  it("evicts the oldest entry when exceeding MAX_ENTRIES (FIFO)", () => {
    // MAX_ENTRIES is 500. We push 501 and expect the first one to be gone.
    for (let i = 0; i < 500; i++) {
      cacheSummary(`id-${i}`, mockSummary(String(i)));
    }
    expect(__summaryCacheSize()).toBe(500);
    cacheSummary("id-500", mockSummary("500"));
    expect(__summaryCacheSize()).toBe(500);
    expect(getCachedSummary("id-0")).toBeUndefined();
    expect(getCachedSummary("id-500")?.summary).toBe("summary 500");
  });
});
