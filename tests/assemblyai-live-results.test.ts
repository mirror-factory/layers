/**
 * PROD-474 -- AssemblyAI v3 Universal Streaming WS message parser.
 *
 * Verifies the message-level contract between the recorder and the
 * AssemblyAI streaming WebSocket so the live recorder state machine
 * (checking mic -> creating session -> connecting provider -> listening
 * -> transcribing -> finalizing) can rely on a stable parsed shape.
 */

import { describe, expect, it } from "vitest";
import { parseAssemblyAiLiveMessage } from "@/lib/assemblyai/live-results";

describe("AssemblyAI Universal Streaming message parsing", () => {
  it("returns 'ignore' for non-Turn frames", () => {
    expect(parseAssemblyAiLiveMessage({ type: "Begin", id: "s1", expires_at: 1 }))
      .toEqual({ kind: "ignore" });
    expect(parseAssemblyAiLiveMessage({ type: "Termination" }))
      .toEqual({ kind: "ignore" });
    expect(parseAssemblyAiLiveMessage(null)).toEqual({ kind: "ignore" });
    expect(parseAssemblyAiLiveMessage("plain string")).toEqual({ kind: "ignore" });
  });

  it("returns 'ignore' when the transcript is empty or whitespace", () => {
    expect(
      parseAssemblyAiLiveMessage({
        type: "Turn",
        end_of_turn: false,
        transcript: "   ",
      }),
    ).toEqual({ kind: "ignore" });

    expect(
      parseAssemblyAiLiveMessage({
        type: "Turn",
        end_of_turn: true,
        transcript: "",
      }),
    ).toEqual({ kind: "ignore" });
  });

  it("returns 'partial' for in-progress turns", () => {
    const result = parseAssemblyAiLiveMessage({
      type: "Turn",
      end_of_turn: false,
      transcript: "Budget is",
    });

    expect(result).toEqual({ kind: "partial", text: "Budget is" });
  });

  it("returns 'final' with timing for an end-of-turn event", () => {
    const result = parseAssemblyAiLiveMessage({
      type: "Turn",
      end_of_turn: true,
      transcript: "Budget was approved.",
      speaker: "Speaker 1",
      words: [
        { text: "Budget", start: 1200, end: 1600, confidence: 0.95 },
        { text: "was", start: 1700, end: 1800, confidence: 0.97 },
        { text: "approved.", start: 1900, end: 2400, confidence: 0.94 },
      ],
    });

    expect(result).toEqual({
      kind: "final",
      turn: {
        speaker: "Speaker 1",
        text: "Budget was approved.",
        start: 1200,
        end: 2400,
        confidence: 0.95,
        final: true,
      },
    });
  });

  it("falls back to speaker_label when speaker is missing", () => {
    const result = parseAssemblyAiLiveMessage({
      type: "Turn",
      end_of_turn: true,
      transcript: "Hello.",
      speaker_label: "B",
      words: [{ text: "Hello.", start: 100, end: 400, confidence: 0.9 }],
    });

    expect(result).toMatchObject({ kind: "final" });
    if (result.kind !== "final") throw new Error("expected final turn");
    expect(result.turn.speaker).toBe("B");
  });

  it("zeroes timing when the words array is missing or malformed", () => {
    const result = parseAssemblyAiLiveMessage({
      type: "Turn",
      end_of_turn: true,
      transcript: "Okay.",
      words: null,
    });

    expect(result).toEqual({
      kind: "final",
      turn: {
        speaker: null,
        text: "Okay.",
        start: 0,
        end: 0,
        confidence: 0,
        final: true,
      },
    });
  });

  it("uses 'utterance' as a transcript fallback", () => {
    const result = parseAssemblyAiLiveMessage({
      type: "Turn",
      end_of_turn: false,
      utterance: "checking one two",
    });

    expect(result).toEqual({ kind: "partial", text: "checking one two" });
  });
});
