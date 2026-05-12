/**
 * OpenAI batch transcription model registry (PROD-363).
 *
 * Keeps the supported model identifiers in one place so callers, settings UI,
 * and tests stay in sync. Pricing for these models is sourced from the STT
 * pricing catalog in `lib/billing/stt-pricing.ts`; this file is intentionally
 * shape-only and free of pricing details.
 */

export const OPENAI_TRANSCRIPTION_MODELS = [
  "whisper-1",
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
] as const;

export type OpenAiTranscriptionModel =
  (typeof OPENAI_TRANSCRIPTION_MODELS)[number];

export interface OpenAiTranscriptionModelDescriptor {
  model: OpenAiTranscriptionModel;
  label: string;
  /** True when the model is launch-ready in the runtime. */
  enabled: boolean;
  /** Vendor capabilities surfaced for UI / docs. */
  capabilities: {
    diarization: false;
    languageHint: boolean;
    verboseJson: boolean;
  };
  notes: string;
}

export const OPENAI_TRANSCRIPTION_MODEL_DESCRIPTORS: OpenAiTranscriptionModelDescriptor[] = [
  {
    model: "whisper-1",
    label: "Whisper (whisper-1)",
    // Hidden until runtime support is complete (see PROD-363 AC).
    enabled: false,
    capabilities: {
      diarization: false,
      languageHint: true,
      verboseJson: true,
    },
    notes:
      "Legacy Whisper batch model. Supports verbose_json with segment timings. No native diarization.",
  },
  {
    model: "gpt-4o-mini-transcribe",
    label: "GPT-4o Mini Transcribe",
    enabled: false,
    capabilities: {
      diarization: false,
      languageHint: true,
      verboseJson: false,
    },
    notes:
      "Lower-cost gpt-4o transcription tier. Returns JSON only; no segment timings or speaker labels.",
  },
  {
    model: "gpt-4o-transcribe",
    label: "GPT-4o Transcribe",
    enabled: false,
    capabilities: {
      diarization: false,
      languageHint: true,
      verboseJson: false,
    },
    notes:
      "Premium gpt-4o transcription tier. Returns JSON only; no segment timings or speaker labels.",
  },
];

export function isOpenAiTranscriptionModel(
  value: string,
): value is OpenAiTranscriptionModel {
  return (OPENAI_TRANSCRIPTION_MODELS as readonly string[]).includes(value);
}

export function getOpenAiTranscriptionModelDescriptor(
  model: OpenAiTranscriptionModel,
): OpenAiTranscriptionModelDescriptor {
  const descriptor = OPENAI_TRANSCRIPTION_MODEL_DESCRIPTORS.find(
    (entry) => entry.model === model,
  );
  if (!descriptor) {
    throw new Error(`Unknown OpenAI transcription model: ${model}`);
  }
  return descriptor;
}
