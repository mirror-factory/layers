/**
 * PCM downsampler AudioWorklet for AssemblyAI v3 streaming.
 *
 * Browsers capture mic at 44.1k or 48k; AssemblyAI wants 16k PCM
 * int16 little-endian. We collect input samples, decimate with
 * linear interpolation (not ideal but fine for speech after a
 * BiquadFilter low-pass in the graph), and emit ~150ms chunks so
 * the server-side WebSocket has enough data per frame but isn't
 * starved.
 *
 * Emits: ArrayBuffer of Int16LE samples via port.postMessage.
 *
 * This file is served from /worklets/pcm-downsampler.js — Next.js
 * copies `public/` as-is. Do NOT import any modules here; worklets
 * run in their own scope with no module support.
 */

class PcmDownsamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options?.processorOptions ?? {};
    this.inputSampleRate = opts.inputSampleRate ?? 48000;
    this.outputSampleRate = opts.outputSampleRate ?? 16000;
    this.chunkDurationMs = opts.chunkDurationMs ?? 150;
    this.ratio = this.inputSampleRate / this.outputSampleRate;

    // Number of 16k samples per chunk we emit to the main thread.
    this.outputChunkSize = Math.round(
      (this.outputSampleRate * this.chunkDurationMs) / 1000,
    );

    this.buffer = new Float32Array(this.outputChunkSize);
    this.bufferFill = 0;

    // Running fractional index into the current input block; lets
    // chunks flow continuously across process() calls without
    // dropping or duplicating samples.
    this.sourceOffset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    let srcIdx = this.sourceOffset;
    while (srcIdx < channel.length) {
      // Linear interpolation between the two surrounding samples.
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(i0 + 1, channel.length - 1);
      const frac = srcIdx - i0;
      const s = channel[i0] * (1 - frac) + channel[i1] * frac;

      this.buffer[this.bufferFill++] = s;

      if (this.bufferFill >= this.outputChunkSize) {
        const int16 = new Int16Array(this.outputChunkSize);
        for (let i = 0; i < this.outputChunkSize; i++) {
          const v = Math.max(-1, Math.min(1, this.buffer[i]));
          int16[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
        }
        this.port.postMessage(int16.buffer, [int16.buffer]);
        this.bufferFill = 0;
      }

      srcIdx += this.ratio;
    }

    // Remember how far past the block we are; negative means we still
    // have room before the next sample.
    this.sourceOffset = srcIdx - channel.length;
    return true;
  }
}

registerProcessor("pcm-downsampler", PcmDownsamplerProcessor);
