/**
 * Client construction tests.
 *
 * Confirms: API key is required, client is cached per-process, batch
 * model defaults to 'best' (Universal-3 Pro).
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  getAssemblyAI,
  __resetAssemblyAIClient,
  getBatchModel,
} from "@/lib/assemblyai/client";

describe("getAssemblyAI", () => {
  const originalKey = process.env.ASSEMBLYAI_API_KEY;
  const originalModel = process.env.ASSEMBLYAI_BATCH_MODEL;

  beforeEach(() => {
    __resetAssemblyAIClient();
  });

  afterEach(() => {
    process.env.ASSEMBLYAI_API_KEY = originalKey;
    process.env.ASSEMBLYAI_BATCH_MODEL = originalModel;
    __resetAssemblyAIClient();
  });

  it("throws a helpful message when ASSEMBLYAI_API_KEY is missing", () => {
    delete process.env.ASSEMBLYAI_API_KEY;
    expect(() => getAssemblyAI()).toThrow(/ASSEMBLYAI_API_KEY/);
  });

  it("caches the client after first construction", () => {
    process.env.ASSEMBLYAI_API_KEY = "test-key";
    const a = getAssemblyAI();
    const b = getAssemblyAI();
    expect(a).toBe(b);
  });

  it("defaults getBatchModel to 'best' when env unset", () => {
    delete process.env.ASSEMBLYAI_BATCH_MODEL;
    expect(getBatchModel()).toBe("best");
  });

  it("honors ASSEMBLYAI_BATCH_MODEL override", () => {
    process.env.ASSEMBLYAI_BATCH_MODEL = "nano";
    expect(getBatchModel()).toBe("nano");
  });
});
