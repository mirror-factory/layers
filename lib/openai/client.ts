/**
 * OpenAI transcription adapter (PROD-363).
 *
 * Mirrors the shape of the AssemblyAI / Deepgram adapters:
 *   - `getOpenAiApiKey()` -- read-only env lookup, no exceptions
 *   - `getOpenAiClient()` -- returns null when not configured
 *   - `requireOpenAiClient()` -- throws `OpenAiConfigurationError`
 *   - `transcribeAudio(client, options)` -- POSTs multipart audio and
 *     returns a normalized `OpenAiTranscriptionResult`
 *
 * Supports three batch transcription models:
 *   - `whisper-1`
 *   - `gpt-4o-mini-transcribe`
 *   - `gpt-4o-transcribe`
 *
 * Diarization is **not** provided by OpenAI's transcription endpoint -- the
 * runtime falls back to a single speaker label. Pair this adapter with a
 * downstream diarization pass (e.g. AssemblyAI speaker labels) when speaker
 * separation is required.
 *
 * Telemetry: callers should wrap `transcribeAudio` with
 * `withExternalCall({ vendor: 'openai', operation: 'audio.transcriptions',
 * modelId })` so the call shows up in the cost-by-vendor dashboard and the
 * Langfuse trace tree (same wiring used for AssemblyAI/Firecrawl).
 */

import { OPENAI_TRANSCRIPTION_MODELS, type OpenAiTranscriptionModel } from "./models";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

type Env = Record<string, string | undefined>;

export class OpenAiConfigurationError extends Error {
  code = "missing_openai_api_key";

  constructor() {
    super("OPENAI_API_KEY is required for OpenAI transcription");
    this.name = "OpenAiConfigurationError";
  }
}

export interface OpenAiClient {
  apiKey: string;
  baseUrl: string;
}

let instance: OpenAiClient | null = null;
let instanceApiKey: string | null = null;

export function getOpenAiApiKey(env: Env = process.env as Env): string | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  return apiKey || null;
}

export function getOpenAiBaseUrl(env: Env = process.env as Env): string {
  return env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

export function getOpenAiClient(): OpenAiClient | null {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  if (instance && instanceApiKey === apiKey) return instance;

  instance = { apiKey, baseUrl: getOpenAiBaseUrl() };
  instanceApiKey = apiKey;
  return instance;
}

export function requireOpenAiClient(): OpenAiClient {
  const client = getOpenAiClient();
  if (!client) throw new OpenAiConfigurationError();
  return client;
}

/** Test-only: drop the cached client so env stubs apply on next call. */
export function __resetOpenAiClientForTests(): void {
  instance = null;
  instanceApiKey = null;
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

export interface TranscribeAudioOptions {
  /** Audio bytes (mp3, wav, m4a, webm, ogg, etc -- see OpenAI docs). */
  audio: Blob | Buffer | Uint8Array;
  /** One of `whisper-1`, `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`. */
  model: OpenAiTranscriptionModel;
  /** Filename to send in the multipart upload. Defaults to "audio.webm". */
  filename?: string;
  /** Optional MIME type for the multipart blob. */
  contentType?: string;
  /** ISO-639-1 language hint (improves accuracy + latency). */
  language?: string;
  /** Prompt used to bias decoding (style, vocabulary). */
  prompt?: string;
  /**
   * Sampling temperature, 0..1. `whisper-1` honours this; the gpt-4o
   * transcription models accept but generally ignore it.
   */
  temperature?: number;
  /**
   * Response shape. `verbose_json` is whisper-1 only and surfaces segment
   * timings; the gpt-4o models only emit `json` or `text`.
   */
  responseFormat?: "json" | "text" | "verbose_json";
  /** Optional fetch override (useful for tests). */
  fetchImpl?: typeof fetch;
  /** Abort signal forwarded to fetch. */
  signal?: AbortSignal;
}

export interface OpenAiTranscriptionSegment {
  id?: number;
  start?: number;
  end?: number;
  text: string;
}

export interface OpenAiTranscriptionResult {
  /** Transcript text (always present). */
  text: string;
  /** Model that produced the transcript. */
  model: OpenAiTranscriptionModel;
  /** Detected/declared language, when the API returns one. */
  language?: string;
  /** Audio duration in seconds, when surfaced (whisper verbose_json). */
  durationSeconds?: number;
  /** Segment-level timings (whisper verbose_json only). */
  segments?: OpenAiTranscriptionSegment[];
  /** Raw response for callers that need vendor-specific fields. */
  raw: unknown;
}

export class OpenAiTranscriptionError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "OpenAiTranscriptionError";
    this.status = status;
    this.body = body;
  }
}

function assertSupportedModel(
  model: string,
): asserts model is OpenAiTranscriptionModel {
  if (!(OPENAI_TRANSCRIPTION_MODELS as readonly string[]).includes(model)) {
    throw new Error(
      `Unsupported OpenAI transcription model "${model}". Expected one of: ${OPENAI_TRANSCRIPTION_MODELS.join(", ")}`,
    );
  }
}

function toBlob(
  audio: Blob | Buffer | Uint8Array,
  contentType?: string,
): Blob {
  if (audio instanceof Blob) return audio;
  // Cast through BlobPart: Buffer/Uint8Array have an `ArrayBufferLike` buffer
  // (could be SharedArrayBuffer) which TypeScript narrows out of BlobPart in
  // strict mode. The runtime supports it; the cast keeps the public API
  // permissive.
  return new Blob([audio as unknown as BlobPart], {
    type: contentType ?? "application/octet-stream",
  });
}

/**
 * Submit audio to the OpenAI transcription endpoint.
 *
 * Throws `OpenAiTranscriptionError` for non-2xx responses and a plain
 * `Error` for unsupported models. Wrap with `withExternalCall` upstream to
 * record cost, duration, and Langfuse spans -- this function intentionally
 * does not log on its own so it remains pure and easy to unit-test.
 */
export async function transcribeAudio(
  client: OpenAiClient,
  options: TranscribeAudioOptions,
): Promise<OpenAiTranscriptionResult> {
  assertSupportedModel(options.model);

  const fetchImpl = options.fetchImpl ?? fetch;
  const form = new FormData();
  const blob = toBlob(options.audio, options.contentType);
  form.append("file", blob, options.filename ?? "audio.webm");
  form.append("model", options.model);

  if (options.language) form.append("language", options.language);
  if (options.prompt) form.append("prompt", options.prompt);
  if (typeof options.temperature === "number") {
    form.append("temperature", String(options.temperature));
  }

  // whisper-1 supports verbose_json (segments); gpt-4o models only support
  // json + text. Default to json so behavior is identical across models.
  const responseFormat = options.responseFormat
    ?? (options.model === "whisper-1" ? "verbose_json" : "json");
  if (responseFormat === "verbose_json" && options.model !== "whisper-1") {
    throw new Error(
      `responseFormat "verbose_json" is only supported on whisper-1, not ${options.model}`,
    );
  }
  form.append("response_format", responseFormat);

  const response = await fetchImpl(
    `${client.baseUrl}/audio/transcriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.apiKey}`,
      },
      body: form,
      signal: options.signal,
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new OpenAiTranscriptionError(
      `OpenAI transcription failed (${response.status})`,
      response.status,
      body,
    );
  }

  if (responseFormat === "text") {
    const text = await response.text();
    return { text, model: options.model, raw: text };
  }

  const json = (await response.json()) as Record<string, unknown>;
  const text = typeof json.text === "string" ? json.text : "";
  const language = typeof json.language === "string" ? json.language : undefined;
  const durationSeconds =
    typeof json.duration === "number" ? json.duration : undefined;
  const segments = Array.isArray(json.segments)
    ? (json.segments as Array<Record<string, unknown>>).map((seg) => ({
        id: typeof seg.id === "number" ? seg.id : undefined,
        start: typeof seg.start === "number" ? seg.start : undefined,
        end: typeof seg.end === "number" ? seg.end : undefined,
        text: typeof seg.text === "string" ? seg.text : "",
      }))
    : undefined;

  return {
    text,
    model: options.model,
    language,
    durationSeconds,
    segments,
    raw: json,
  };
}

export { OPENAI_TRANSCRIPTION_MODELS } from "./models";
export type { OpenAiTranscriptionModel } from "./models";
