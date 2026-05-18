/**
 * PROD-500 / recording Stop-flow contract.
 *
 * The browser/native Stop button posts to this route, then navigates to
 * `/meetings/[id]`. These tests prove the server-side half of that flow:
 * finalize accepts accumulated transcript turns, marks the meeting completed,
 * persists summary/intake/cost data, and does not require action due dates to
 * be normalized before returning the completed meeting payload.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Meeting } from "@/lib/meetings/types";
import type { MeetingsStore } from "@/lib/meetings/store";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  summarizeMeeting: vi.fn(),
  extractIntakeForm: vi.fn(),
  getMeetingsStore: vi.fn(),
  getSettings: vi.fn(),
  getCurrentUserId: vi.fn(),
  fireWebhooks: vi.fn(),
  embedMeeting: vi.fn(),
  flushLangfuse: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  );
  return {
    ...actual,
    after: mocks.after,
  };
});

vi.mock("@/lib/assemblyai/summary", () => ({
  summarizeMeeting: mocks.summarizeMeeting,
}));

vi.mock("@/lib/assemblyai/intake", () => ({
  extractIntakeForm: mocks.extractIntakeForm,
}));

vi.mock("@/lib/meetings/store", () => ({
  getMeetingsStore: mocks.getMeetingsStore,
}));

vi.mock("@/lib/settings", () => ({
  getSettings: mocks.getSettings,
}));

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getSupabaseUser: vi.fn(),
}));

vi.mock("@/lib/webhooks/fire", () => ({
  fireWebhooks: mocks.fireWebhooks,
}));

vi.mock("@/lib/embeddings/embed-meeting", () => ({
  embedMeeting: mocks.embedMeeting,
}));

vi.mock("@/lib/langfuse-flush", () => ({
  flushLangfuse: mocks.flushLangfuse,
}));

const finalizeRoute = await import(
  "@/app/api/transcribe/stream/finalize/route"
);

function request(body?: unknown): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/transcribe/stream/finalize",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req_finalize_test",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}

function completedMeeting(
  patch: Partial<Meeting> = {},
): Meeting {
  return {
    id: "meeting_stop_flow",
    status: "completed",
    title: "Roadmap Stop Flow",
    text: "We should ship this to testers after the stop flow proof.",
    utterances: [
      {
        speaker: "Alex",
        text: "Ship this to testers after the stop flow proof.",
        start: 0,
        end: 4200,
        confidence: 0.97,
      },
    ],
    durationSeconds: 42,
    summary: null,
    intakeForm: null,
    costBreakdown: null,
    userNotes: null,
    error: null,
    createdAt: "2026-05-17T20:00:00.000Z",
    updatedAt: "2026-05-17T20:01:00.000Z",
    ...patch,
  };
}

function baseStore(): MeetingsStore {
  return {
    insert: vi.fn(),
    update: vi.fn(async (id, patch) =>
      completedMeeting({
        id,
        status: patch.status ?? "completed",
        title: patch.title ?? "Roadmap Stop Flow",
        text: patch.text ?? "",
        utterances: patch.utterances ?? [],
        durationSeconds: patch.durationSeconds ?? null,
        summary: patch.summary ?? null,
        intakeForm: patch.intakeForm ?? null,
        costBreakdown: patch.costBreakdown ?? null,
      }),
    ),
    get: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  };
}

describe("app/api/transcribe/stream/finalize/route.ts integration behavior", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.after.mockImplementation((fn: () => void | Promise<void>) => {
      void fn();
    });
    mocks.getCurrentUserId.mockResolvedValue(null);
    mocks.getSettings.mockResolvedValue({
      summaryModel: "openai/gpt-5.4-nano",
      batchSpeechModel: "universal-2",
      streamingSpeechModel: "universal-streaming-multilingual",
    });
    mocks.extractIntakeForm.mockResolvedValue({
      intake: {
        intent: "internal planning",
        primaryParticipant: null,
        organization: null,
        contactInfo: { email: null, phone: null },
        budgetMentioned: null,
        timeline: "after proof",
        decisionMakers: [],
        requirements: ["Stop flow must complete"],
        painPoints: [],
        nextSteps: ["Run browser proof"],
      },
      model: "openai/gpt-5.4-nano",
      usage: { inputTokens: 120, outputTokens: 60 },
      skipped: false,
    });
  });

  it("marks the meeting completed and returns the finalized payload", async () => {
    const store = baseStore();
    mocks.getMeetingsStore.mockResolvedValue(store);
    mocks.summarizeMeeting.mockResolvedValue({
      summary: {
        title: "Roadmap Stop Flow",
        summary: "The team agreed to prove the stop flow before tester rollout.",
        keyPoints: ["Stop flow proof is required"],
        actionItems: [
          {
            assignee: "Alex",
            task: "Run current-branch Stop-flow proof",
            dueDate: "next Friday",
          },
        ],
        decisions: ["Do not broaden tester rollout without proof"],
        participants: ["Alex"],
      },
      model: "openai/gpt-5.4-nano",
      usage: { inputTokens: 220, outputTokens: 90 },
      skipped: false,
    });

    const res = await finalizeRoute.POST(
      request({
        meetingId: "meeting_stop_flow",
        meetingTitle: "Product planning session",
        calendarEventId: "cal_123",
        text: "We should ship this to testers after the stop flow proof.",
        recordingDirectives: [
          {
            type: "mark_action",
            instruction: "Make this an action item",
            targetText: "Run current-branch Stop-flow proof",
            atSeconds: 18,
          },
        ],
        utterances: [
          {
            speaker: "Alex",
            text: "We should ship this to testers after the stop flow proof.",
            start: 0,
            end: 4200,
            confidence: 0.97,
          },
        ],
        durationSeconds: 42,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req_finalize_test");
    expect(store.update).toHaveBeenCalledWith(
      "meeting_stop_flow",
      expect.objectContaining({
        status: "completed",
        title: "Product planning session",
        text: "We should ship this to testers after the stop flow proof.",
        durationSeconds: 42,
        summary: expect.objectContaining({
          actionItems: [
            expect.objectContaining({
              dueDate: "next Friday",
              task: "Run current-branch Stop-flow proof",
            }),
          ],
        }),
      }),
    );
    expect(body).toMatchObject({
      id: "meeting_stop_flow",
      status: "completed",
      text: "We should ship this to testers after the stop flow proof.",
      durationSeconds: 42,
      summary: {
        actionItems: [
          {
            assignee: "Alex",
            task: "Run current-branch Stop-flow proof",
            dueDate: "next Friday",
          },
        ],
      },
      costBreakdown: {
        stt: {
          mode: "streaming",
          model: "universal-streaming-multilingual",
          durationSeconds: 42,
        },
        llm: {
          totalInputTokens: 340,
          totalOutputTokens: 150,
        },
      },
    });
  });

  it("returns 400 before touching providers or storage for malformed Stop payloads", async () => {
    const store = baseStore();
    mocks.getMeetingsStore.mockResolvedValue(store);

    const res = await finalizeRoute.POST(
      request({
        meetingId: "",
        utterances: [{ speaker: "Alex", text: "missing timing fields" }],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toEqual(expect.any(Array));
    expect(mocks.summarizeMeeting).not.toHaveBeenCalled();
    expect(mocks.extractIntakeForm).not.toHaveBeenCalled();
    expect(mocks.getMeetingsStore).not.toHaveBeenCalled();
  });

  it("fails closed when the meeting row disappeared before Stop finalize", async () => {
    const store = baseStore();
    vi.mocked(store.update).mockResolvedValue(null);
    mocks.getMeetingsStore.mockResolvedValue(store);
    mocks.summarizeMeeting.mockResolvedValue({
      summary: {
        title: "Missing Meeting",
        summary: "Finalize could not find the original meeting row.",
        keyPoints: [],
        actionItems: [],
        decisions: [],
        participants: [],
      },
      model: "openai/gpt-5.4-nano",
      usage: { inputTokens: 20, outputTokens: 10 },
      skipped: false,
    });

    const res = await finalizeRoute.POST(
      request({
        meetingId: "missing_meeting",
        text: "This local recording should not be cleared if the meeting vanished.",
        utterances: [
          {
            speaker: "Alex",
            text: "This local recording should not be cleared if the meeting vanished.",
            start: 0,
            end: 3000,
            confidence: 0.95,
          },
        ],
        durationSeconds: 3,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Meeting not found" });
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.fireWebhooks).not.toHaveBeenCalled();
    expect(mocks.embedMeeting).not.toHaveBeenCalled();
  });
});
