import { describe, expect, it, vi, beforeEach } from "vitest";
import { TOOL_METADATA } from "@/lib/ai/tools/_metadata";
import { allTools } from "@/lib/ai/tools";
import { codeReview } from "@/lib/ai/tools/code-review";
import { searchMeetings } from "@/lib/embeddings/search";
import { getMeetingsStore } from "@/lib/meetings/store";
import { getCurrentUserId } from "@/lib/supabase/user";
import { mockToolInputs, mockToolOutputs } from "./mock-tool-data";

vi.mock("@/lib/embeddings/search", () => ({
  searchMeetings: vi.fn(),
}));

vi.mock("@/lib/meetings/store", () => ({
  getMeetingsStore: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: vi.fn(),
}));

type ToolOptions = { toolCallId: string; messages: [] };
type ExecutableTool<Input, Output> = {
  inputSchema?: { safeParse: (input: unknown) => { success: boolean } };
  execute?: (input: Input, options: ToolOptions) => Promise<Output> | Output;
};

const toolOptions: ToolOptions = { toolCallId: "test-call", messages: [] };

function executable<Input, Output>(tool: unknown): Required<ExecutableTool<Input, Output>> {
  const candidate = tool as ExecutableTool<Input, Output>;
  if (!candidate.execute || !candidate.inputSchema) {
    throw new Error("Tool is missing execute or inputSchema");
  }
  return candidate as Required<ExecutableTool<Input, Output>>;
}

describe("AI tool registry", () => {
  it("tracks every server-side AI tool with passing metadata", () => {
    const implemented = new Set([...Object.keys(allTools), "codeReview"]);
    const registered = new Set(TOOL_METADATA.map((tool) => tool.name));

    expect(registered).toEqual(implemented);

    for (const tool of TOOL_METADATA) {
      expect(tool.description.length, `${tool.name} description is too short`).toBeGreaterThanOrEqual(50);
      expect(tool.permissionTier, `${tool.name} missing permission tier`).toBeDefined();
      expect(tool.costEstimate, `${tool.name} missing cost estimate`).toBeDefined();
      expect(tool.testStatus, `${tool.name} is not marked tested`).toBe("passing");
      expect(tool.name in mockToolInputs, `${tool.name} missing mock input`).toBe(true);
      expect(tool.name in mockToolOutputs, `${tool.name} missing mock output`).toBe(true);
    }
  });
});

describe("AI tool contracts", () => {
  beforeEach(() => {
    vi.mocked(searchMeetings).mockReset();
    vi.mocked(getMeetingsStore).mockReset();
    vi.mocked(getCurrentUserId).mockReset();
  });

  it("searchMeetings validates input and scopes search to the current user", async () => {
    const tool = executable<
      { query: string; limit?: number },
      { results?: Array<{ meetingId: string; relevance: number }>; error?: string }
    >(allTools.searchMeetings);

    expect(tool.inputSchema.safeParse({ query: "pricing", limit: 5 }).success).toBe(true);
    expect(tool.inputSchema.safeParse(mockToolInputs.searchMeetings).success).toBe(true);
    expect(tool.inputSchema.safeParse({ query: "pricing", limit: 99 }).success).toBe(false);

    vi.mocked(getCurrentUserId).mockResolvedValue("user_a");
    vi.mocked(searchMeetings).mockResolvedValue([
      {
        meetingId: "meeting_1",
        meetingTitle: "Pricing call",
        meetingDate: "2026-04-24T00:00:00.000Z",
        chunkText: "Budget discussion",
        chunkType: "transcript",
        similarity: 0.91,
      },
    ]);

    const result = await tool.execute(mockToolInputs.searchMeetings, toolOptions);

    expect(searchMeetings).toHaveBeenCalledWith("pricing", "user_a", 3);
    expect(result.results?.[0]).toMatchObject(mockToolOutputs.searchMeetings.results[0]);
  });

  it("searchMeetings returns an auth error when no user is available", async () => {
    const tool = executable<{ query: string }, { results: unknown[]; error?: string }>(allTools.searchMeetings);
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    const result = await tool.execute({ query: "anything" }, toolOptions);

    expect(result).toEqual({ results: [], error: "Not authenticated" });
    expect(searchMeetings).not.toHaveBeenCalled();
  });

  it("getMeetingDetails validates input and returns normalized meeting context", async () => {
    const tool = executable<
      { meetingId: string },
      { id?: string; title?: string; transcript?: string; keyPoints?: string[]; error?: string }
    >(allTools.getMeetingDetails);

    expect(tool.inputSchema.safeParse(mockToolInputs.getMeetingDetails).success).toBe(true);
    expect(tool.inputSchema.safeParse({}).success).toBe(false);

    vi.mocked(getMeetingsStore).mockResolvedValue({
      insert: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      get: vi.fn().mockResolvedValue({
        id: "meeting_1",
        title: "Demo call",
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
        durationSeconds: 1800,
        status: "completed",
        text: "Full transcript",
        utterances: [{ speaker: "A", text: "Hello there", start: 0, end: 1, confidence: 0.99 }],
        summary: {
          title: "Demo call",
          summary: "Short summary",
          keyPoints: ["Budget"],
          actionItems: [],
          decisions: [],
          participants: [],
        },
        intakeForm: null,
        costBreakdown: null,
        error: null,
      }),
      delete: vi.fn(),
    });

    const result = await tool.execute(mockToolInputs.getMeetingDetails, toolOptions);

    expect(result).toMatchObject(mockToolOutputs.getMeetingDetails);
  });

  it("listRecentMeetings validates limits and normalizes meeting rows", async () => {
    const tool = executable<
      { limit?: number },
      { meetings: Array<{ id: string; title: string; status: string }> }
    >(allTools.listRecentMeetings);

    expect(tool.inputSchema.safeParse({ limit: 5 }).success).toBe(true);
    expect(tool.inputSchema.safeParse(mockToolInputs.listRecentMeetings).success).toBe(true);
    expect(tool.inputSchema.safeParse({ limit: 99 }).success).toBe(false);

    const list = vi.fn().mockResolvedValue([
      {
        id: "meeting_1",
        title: null,
        createdAt: "2026-04-24T00:00:00.000Z",
        durationSeconds: 600,
        status: "completed",
      },
    ]);
    vi.mocked(getMeetingsStore).mockResolvedValue({
      insert: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
      list,
      delete: vi.fn(),
    });

    const result = await tool.execute(mockToolInputs.listRecentMeetings, toolOptions);

    expect(list).toHaveBeenCalledWith(1);
    expect(result.meetings).toEqual([
      expect.objectContaining(mockToolOutputs.listRecentMeetings.meetings[0]),
    ]);
  });

  it("codeReview detects security risks and validates input", async () => {
    const tool = executable<
      { code: string; language?: string },
      { critical: number; totalIssues: number }
    >(codeReview);

    expect(tool.inputSchema.safeParse({ code: "const x = 1;" }).success).toBe(true);
    expect(tool.inputSchema.safeParse(mockToolInputs.codeReview).success).toBe(true);
    expect(tool.inputSchema.safeParse({ language: "typescript" }).success).toBe(false);

    const result = await tool.execute(mockToolInputs.codeReview, toolOptions);

    expect(result.critical).toBeGreaterThanOrEqual(mockToolOutputs.codeReview.critical);
    expect(result.totalIssues).toBeGreaterThanOrEqual(mockToolOutputs.codeReview.totalIssues);
  });
});
