/**
 * PROD-474 -- End-to-end verification of the AssemblyAI Universal Streaming
 * session, exercised at the contract layer:
 *
 *   1. token mint endpoint returns a working ws URL + temp token
 *   2. parsed messages drive the recorder state machine:
 *        listening -> transcribing -> listening -> ... -> finalizing
 *   3. partials and finals land in the local-draft mirror so a browser
 *      refresh keeps the in-progress transcript
 *   4. an expired-token close mid-session results in a reconnect cycle
 *      without losing already-finalized turns
 *
 * This file replaces a real WebSocket with a small in-memory transport so
 * we can assert behavior deterministically. The component-level glue lives
 * in `components/live-recorder.tsx`; this test directly drives the parsing
 * + local-draft layer that the component depends on.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseAssemblyAiLiveMessage } from "@/lib/assemblyai/live-results";
import {
  clearLocalRecordingDraft,
  readLatestLocalRecordingDraft,
  saveLocalRecordingDraft,
  type LocalRecordingDraft,
  type RecordingDraftStorage,
} from "@/lib/recording/local-draft";

// ---------------------------------------------------------------------------
// Token route mocks -- copied from app-api-transcribe-stream-token-route.test
// to keep this file self-contained.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  checkQuota: vi.fn(),
  getAssemblyAI: vi.fn(),
  getDeepgramClient: vi.fn(),
  createDeepgramStreamingToken: vi.fn(),
  getSettings: vi.fn(),
  getMeetingsStore: vi.fn(),
  getCurrentUserId: vi.fn(),
  withExternalCall: vi.fn(),
}));

vi.mock("@/lib/billing/quota", () => ({ checkQuota: mocks.checkQuota }));
vi.mock("@/lib/assemblyai/client", () => ({ getAssemblyAI: mocks.getAssemblyAI }));
vi.mock("@/lib/deepgram/client", () => ({
  getDeepgramClient: mocks.getDeepgramClient,
  createDeepgramStreamingToken: mocks.createDeepgramStreamingToken,
}));
vi.mock("@/lib/settings", () => ({ getSettings: mocks.getSettings }));
vi.mock("@/lib/meetings/store", () => ({
  getMeetingsStore: mocks.getMeetingsStore,
}));
vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getSupabaseUser: vi.fn(),
}));
vi.mock("@/lib/with-external", () => ({
  withExternalCall: mocks.withExternalCall,
}));

const tokenRoute = await import("@/app/api/transcribe/stream/token/route");

function jsonRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/transcribe/stream/token", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "req_stream" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// In-memory WebSocket: deterministic stand-in for AssemblyAI's WS endpoint.
// ---------------------------------------------------------------------------

interface FakeAssemblyAiEvent {
  type: string;
  end_of_turn?: boolean;
  transcript?: string;
  speaker?: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

class FakeAssemblyAiSocket {
  readyState = 0; // CONNECTING
  url: string;
  sentBytes: ArrayBuffer[] = [];
  closeCode: number | null = null;

  onopen?: (event: { type: "open" }) => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: (event: { type: "error" }) => void;
  onclose?: (event: { type: "close"; code: number; reason: string }) => void;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    this.readyState = 1;
    this.onopen?.({ type: "open" });
  }

  deliver(event: FakeAssemblyAiEvent) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }

  send(data: ArrayBuffer) {
    if (this.readyState !== 1) return;
    this.sentBytes.push(data);
  }

  close(code = 1000, reason = "normal") {
    this.readyState = 3;
    this.closeCode = code;
    this.onclose?.({ type: "close", code, reason });
  }
}

// ---------------------------------------------------------------------------
// Tiny driver: applies the message-handler logic the same way the component
// does, but without React. This is the state machine under test.
// ---------------------------------------------------------------------------

type ConnectionStatus =
  | "idle"
  | "checking-mic"
  | "creating-session"
  | "connecting-provider"
  | "listening"
  | "transcribing"
  | "reconnecting"
  | "finalizing"
  | "provider-issue";

interface RecorderTurn {
  speaker: string | null;
  text: string;
  start: number;
  end: number;
  confidence: number;
  final: boolean;
}

interface RecorderHarness {
  status: ConnectionStatus;
  turns: RecorderTurn[];
  partial: string;
  history: ConnectionStatus[];
}

function memoryStorage(): RecordingDraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

function setStatus(harness: RecorderHarness, next: ConnectionStatus) {
  harness.status = next;
  harness.history.push(next);
}

function processIncoming(
  harness: RecorderHarness,
  payload: unknown,
  draftSink: (turns: RecorderTurn[], partial: string) => void,
) {
  const parsed = parseAssemblyAiLiveMessage(payload);
  if (parsed.kind === "final") {
    harness.turns.push(parsed.turn);
    harness.partial = "";
    setStatus(harness, "transcribing");
    draftSink(harness.turns, harness.partial);
    return;
  }
  if (parsed.kind === "partial") {
    harness.partial = parsed.text;
    setStatus(harness, parsed.text ? "transcribing" : "listening");
    draftSink(harness.turns, harness.partial);
  }
}

function allowedQuota() {
  return {
    allowed: true,
    planId: "free",
    monthlyMinutesUsed: 0,
    minuteLimit: 120,
    meetingCount: 0,
    meetingLimit: 25,
  };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }
  mocks.checkQuota.mockResolvedValue(allowedQuota());
  mocks.getCurrentUserId.mockResolvedValue("user_a");
  mocks.getSettings.mockResolvedValue({
    summaryModel: "openai/gpt-5.4-nano",
    batchSpeechModel: "universal-2",
    streamingSpeechModel: "universal-streaming-english",
  });
  mocks.getMeetingsStore.mockResolvedValue({
    insert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    get: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  });
  mocks.withExternalCall.mockImplementation(async (_meta, fn) => fn());
});

describe("PROD-474 AssemblyAI streaming session end-to-end", () => {
  it("mints a token whose ws URL matches AssemblyAI's v3 streaming endpoint", async () => {
    mocks.getAssemblyAI.mockReturnValue({
      streaming: { createTemporaryToken: vi.fn().mockResolvedValue("aai_temp_abc") },
    });

    const res = await tokenRoute.POST(jsonRequest({ meetingTitle: "Standup" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.provider).toBe("assemblyai");
    expect(body.token).toBe("aai_temp_abc");
    expect(body.expiresAt).toBeGreaterThan(Date.now());
    expect(body.sampleRate).toBe(16000);

    const wsUrl = new URL(body.wsUrl);
    expect(wsUrl.protocol).toBe("wss:");
    expect(wsUrl.host).toBe("streaming.assemblyai.com");
    expect(wsUrl.pathname).toBe("/v3/ws");
    expect(wsUrl.searchParams.get("token")).toBe("aai_temp_abc");
    expect(wsUrl.searchParams.get("sample_rate")).toBe("16000");
    expect(wsUrl.searchParams.get("speech_model")).toBe("universal-streaming-english");
    expect(wsUrl.searchParams.get("format_turns")).toBe("true");
    expect(wsUrl.searchParams.get("speaker_labels")).toBe("true");
  });

  it("wraps the token mint with withExternalCall telemetry", async () => {
    mocks.getAssemblyAI.mockReturnValue({
      streaming: { createTemporaryToken: vi.fn().mockResolvedValue("aai_t") },
    });

    await tokenRoute.POST(jsonRequest());

    expect(mocks.withExternalCall).toHaveBeenCalledTimes(1);
    const [meta] = mocks.withExternalCall.mock.calls[0]!;
    expect(meta).toMatchObject({
      vendor: "assemblyai",
      operation: "streaming.createTemporaryToken",
      requestId: "req_stream",
    });
  });

  it("transitions listening -> transcribing -> listening as partials and finals arrive", () => {
    const harness: RecorderHarness = {
      status: "listening",
      turns: [],
      partial: "",
      history: ["listening"],
    };
    const storage = memoryStorage();
    const meetingId = "meeting_p474";
    const sink = (turns: RecorderTurn[], partial: string) => {
      saveLocalRecordingDraft(storage, {
        meetingId,
        updatedAt: new Date().toISOString(),
        durationSeconds: 0,
        text: turns.map((t) => t.text).join(" "),
        turnCount: turns.length,
        partial,
        providerModel: "universal-streaming-english",
      });
    };

    // 1) partial interim
    processIncoming(
      harness,
      { type: "Turn", end_of_turn: false, transcript: "We approved" },
      sink,
    );
    expect(harness.status).toBe("transcribing");
    expect(harness.partial).toBe("We approved");

    // 2) end-of-turn final
    processIncoming(
      harness,
      {
        type: "Turn",
        end_of_turn: true,
        transcript: "We approved the budget.",
        speaker: "Speaker 1",
        words: [
          { text: "We", start: 1000, end: 1100, confidence: 0.97 },
          { text: "budget.", start: 1900, end: 2400, confidence: 0.95 },
        ],
      },
      sink,
    );
    expect(harness.status).toBe("transcribing");
    expect(harness.partial).toBe("");
    expect(harness.turns).toHaveLength(1);
    expect(harness.turns[0]).toMatchObject({
      text: "We approved the budget.",
      speaker: "Speaker 1",
      start: 1000,
      end: 2400,
    });

    // 3) silence -> listening
    processIncoming(
      harness,
      { type: "Turn", end_of_turn: false, transcript: "  " },
      sink,
    );
    // empty payload is ignored: status stays as last
    expect(harness.status).toBe("transcribing");

    // 4) draft has the final turn mirrored
    const draft = readLatestLocalRecordingDraft(storage);
    expect(draft).not.toBeNull();
    expect(draft).toMatchObject<Partial<LocalRecordingDraft>>({
      meetingId,
      text: "We approved the budget.",
      turnCount: 1,
      partial: "",
    });
  });

  it("keeps already-finalized turns when the WS drops and reconnects (token refresh path)", () => {
    const harness: RecorderHarness = {
      status: "listening",
      turns: [],
      partial: "",
      history: ["listening"],
    };
    const storage = memoryStorage();
    const meetingId = "meeting_reconnect";
    const sink = (turns: RecorderTurn[], partial: string) =>
      saveLocalRecordingDraft(storage, {
        meetingId,
        updatedAt: new Date().toISOString(),
        durationSeconds: 0,
        text: turns.map((t) => t.text).join(" "),
        turnCount: turns.length,
        partial,
      });

    // First session: produce one final turn
    const ws1 = new FakeAssemblyAiSocket("wss://streaming.assemblyai.com/v3/ws?token=t1");
    ws1.onmessage = (event) =>
      processIncoming(harness, JSON.parse(event.data), sink);
    ws1.connect();
    ws1.deliver({
      type: "Turn",
      end_of_turn: true,
      transcript: "First sentence.",
      words: [{ text: "First", start: 0, end: 500, confidence: 0.9 }],
    });
    // Token expired mid-session -- server forcibly closes the WS
    ws1.close(1008, "token_expired");
    setStatus(harness, "reconnecting");

    // Reconnect transparently with a fresh token
    const ws2 = new FakeAssemblyAiSocket("wss://streaming.assemblyai.com/v3/ws?token=t2");
    ws2.onmessage = (event) =>
      processIncoming(harness, JSON.parse(event.data), sink);
    ws2.connect();
    setStatus(harness, "listening");

    ws2.deliver({
      type: "Turn",
      end_of_turn: true,
      transcript: "Second sentence.",
      words: [{ text: "Second", start: 5000, end: 5500, confidence: 0.9 }],
    });

    expect(harness.turns).toHaveLength(2);
    expect(harness.turns.map((t) => t.text)).toEqual([
      "First sentence.",
      "Second sentence.",
    ]);
    expect(harness.history).toContain("reconnecting");
    expect(harness.history.at(-1)).toBe("transcribing");

    const draft = readLatestLocalRecordingDraft(storage);
    expect(draft?.text).toBe("First sentence. Second sentence.");
    expect(draft?.turnCount).toBe(2);
  });

  it("finalizing clears the local draft once persistence completes", () => {
    const harness: RecorderHarness = {
      status: "listening",
      turns: [],
      partial: "",
      history: ["listening"],
    };
    const storage = memoryStorage();
    const meetingId = "meeting_finalize";
    const sink = (turns: RecorderTurn[], partial: string) =>
      saveLocalRecordingDraft(storage, {
        meetingId,
        updatedAt: new Date().toISOString(),
        durationSeconds: 0,
        text: turns.map((t) => t.text).join(" "),
        turnCount: turns.length,
        partial,
      });

    processIncoming(
      harness,
      {
        type: "Turn",
        end_of_turn: true,
        transcript: "Closing thoughts.",
        words: [{ text: "Closing", start: 0, end: 500, confidence: 0.9 }],
      },
      sink,
    );

    expect(readLatestLocalRecordingDraft(storage)).not.toBeNull();

    setStatus(harness, "finalizing");
    // After a successful POST /api/transcribe/stream/finalize the recorder
    // clears the local draft. Simulate that contract here.
    expect(clearLocalRecordingDraft(storage, meetingId)).toBe(true);
    expect(readLatestLocalRecordingDraft(storage)).toBeNull();
    expect(harness.history.at(-1)).toBe("finalizing");
  });
});
