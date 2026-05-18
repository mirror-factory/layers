/**
 * AssemblyAI v3 Universal Streaming WebSocket message parser.
 *
 * The streaming API emits typed JSON events over the WebSocket; for the
 * purposes of the live recorder we only care about `Turn` events. Each Turn
 * carries an `end_of_turn` flag — when false the transcript is a partial
 * interim, when true it's the final formatted utterance.
 *
 * Reference:
 *   https://www.assemblyai.com/docs/speech-to-text/universal-streaming
 *
 * This parser is intentionally tolerant: unknown event types and malformed
 * payloads return `{ kind: "ignore" }` so the recorder can safely skip them
 * without dropping the WebSocket.
 *
 * PROD-474: extracted from components/live-recorder.tsx so it can be unit-
 * tested without rendering the React component.
 */

export interface AssemblyAiParsedTurn {
  speaker: string | null;
  text: string;
  start: number;
  end: number;
  confidence: number;
  final: true;
}

export type AssemblyAiParsedLiveEvent =
  | { kind: "final"; turn: AssemblyAiParsedTurn }
  | { kind: "partial"; text: string }
  | { kind: "ignore" };

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseAssemblyAiLiveMessage(
  message: unknown,
): AssemblyAiParsedLiveEvent {
  const msg = asRecord(message);
  if (!msg || msg.type !== "Turn") return { kind: "ignore" };

  const transcript =
    asString(msg.transcript) ?? asString(msg.utterance) ?? "";
  if (!transcript.trim()) return { kind: "ignore" };

  if (msg.end_of_turn === true) {
    const words = Array.isArray(msg.words)
      ? msg.words.map(asRecord).filter((word): word is JsonRecord => word !== null)
      : [];
    const firstWord = words[0] ?? null;
    const lastWord = words.at(-1) ?? null;

    return {
      kind: "final",
      turn: {
        speaker: asString(msg.speaker) ?? asString(msg.speaker_label),
        text: transcript,
        start: asNumber(firstWord?.start) ?? 0,
        end: asNumber(lastWord?.end) ?? 0,
        confidence: asNumber(firstWord?.confidence) ?? 0,
        final: true,
      },
    };
  }

  return { kind: "partial", text: transcript };
}
