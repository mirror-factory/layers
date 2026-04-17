/**
 * Unit tests for the PCM downsampler math.
 *
 * The actual worklet runs in the browser AudioWorklet scope (no
 * imports allowed), so we port the core decimation logic into a
 * local function here and verify numerical correctness on a known
 * sinusoid. If this test drifts from the worklet implementation,
 * update both in lockstep.
 */

import { describe, it, expect } from "vitest";

/** Mirrors the per-chunk loop in public/worklets/pcm-downsampler.js. */
function downsampleToInt16LE(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Int16Array {
  const ratio = inputRate / outputRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIdx - i0;
    const s = input[i0] * (1 - frac) + input[i1] * frac;
    const clamped = Math.max(-1, Math.min(1, s));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

function sineWave(
  freqHz: number,
  sampleRate: number,
  durationSeconds: number,
): Float32Array {
  const n = Math.floor(sampleRate * durationSeconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

describe("pcm downsampler", () => {
  it("48k -> 16k keeps one in three samples (duration-exact)", () => {
    const input = sineWave(1000, 48000, 1);
    const out = downsampleToInt16LE(input, 48000, 16000);
    expect(out.length).toBe(16000);
  });

  it("44.1k -> 16k produces ~16000 samples per second", () => {
    const input = sineWave(440, 44100, 1);
    const out = downsampleToInt16LE(input, 44100, 16000);
    // Linear decimation drops by floor; within 1 sample of target.
    expect(out.length).toBeGreaterThanOrEqual(15999);
    expect(out.length).toBeLessThanOrEqual(16001);
  });

  it("maps a full-scale sample to int16 max (signed range)", () => {
    const input = new Float32Array([1, 1, 1, 1, 1, 1]);
    const out = downsampleToInt16LE(input, 48000, 16000);
    expect(out.length).toBe(2);
    for (const s of out) {
      expect(s).toBe(0x7fff);
    }
  });

  it("maps a negative full-scale sample to int16 min", () => {
    const input = new Float32Array([-1, -1, -1, -1, -1, -1]);
    const out = downsampleToInt16LE(input, 48000, 16000);
    for (const s of out) {
      expect(s).toBe(-0x8000);
    }
  });

  it("clamps out-of-range inputs without wrapping", () => {
    // 48k -> 16k ratio of 3, so 12 input samples produce 4 outputs.
    const input = new Float32Array([2, 2, 2, 2, 2, 2, -2, -2, -2, -2, -2, -2]);
    const out = downsampleToInt16LE(input, 48000, 16000);
    expect([...out]).toEqual([0x7fff, 0x7fff, -0x8000, -0x8000]);
  });

  it("preserves signal energy roughly when downsampling a 1kHz tone", () => {
    // 1 kHz is well under 8 kHz Nyquist for 16k output — should survive.
    const input = sineWave(1000, 48000, 0.25);
    const out = downsampleToInt16LE(input, 48000, 16000);
    const rms = Math.sqrt(
      [...out].reduce((s, v) => s + (v / 32768) * (v / 32768), 0) / out.length,
    );
    // Sine RMS = 1/sqrt(2). Allow broad tolerance for quantization.
    expect(rms).toBeGreaterThan(0.5);
    expect(rms).toBeLessThan(0.8);
  });
});
