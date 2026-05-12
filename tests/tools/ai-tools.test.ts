import { describe, expect, it, vi, beforeEach } from "vitest";
import { TOOL_METADATA } from "@/lib/ai/tools/_metadata";
import { allTools } from "@/lib/ai/tools";
import { codeReview } from "@/lib/ai/tools/code-review";
import { searchMeetings } from "@/lib/embeddings/search";
import { getMeetingsStore } from "@/lib/meetings/store";
import { getCurrentUserId } from "@/lib/supabase/user";

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

// Tools intentionally left in non-passing state must explicitly land here
// with a dated TODO. The dated TODO is enforced by the regex below — empty
// strings, undated entries, and stale (> 30d) entries all fail.
//
// Format: "PROD-NNN <YYYY-MM-DD> <reason>". Example:
//   "searchMeetings": "PROD-XXX 2026-05-12 — relying on TestKit canary suite",
const UNTESTED_TOOL_ALLOWLIST: Readonly<Record<string, string>> = {};

const UNTESTED_NOTE_PATTERN = /^PROD-\d+\s+(\d{4}-\d{2}-\d{2})\s+—\s+.+/;
const ALLOWLIST_FRESHNESS_DAYS = 30;

describe("AI tool registry", () => {
  it("tracks every server-side AI tool with metadata for every required field", () => {
    // codeReview is exported separately from allTools but is a server-side tool.
    const implemented = new Set([...Object.keys(allTools), "codeReview"]);
    const registered = new Set(TOOL_METADATA.map((tool) => tool.name));

    expect(registered).toEqual(implemented);

    for (const tool of TOOL_METADATA) {
      expect(tool.description.length, `${tool.name} description is too short (need ≥ 40 chars per PROD-327)`).toBeGreaterThanOrEqual(40);
      expect(tool.permissionTier, `${tool.name} missing permission tier`).toBeDefined();
      expect(tool.access, `${tool.name} missing access level`).toBeDefined();
      expect(["read", "write", "client-side"]).toContain(tool.access);
      expect(tool.service, `${tool.name} missing service`).toBeDefined();
      expect(tool.service.length, `${tool.name} service must not be empty`).toBeGreaterThan(0);
      expect(tool.costEstimate, `${tool.name} missing cost estimate`).toBeDefined();
    }
  });

  it("untested tools must be explicitly allow-listed with a dated TODO ≤ 30 days old", () => {
    const today = new Date();
    const failures: string[] = [];

    for (const tool of TOOL_METADATA) {
      if (tool.testStatus === "passing") continue;

      const note = UNTESTED_TOOL_ALLOWLIST[tool.name];
      if (!note) {
        failures.push(
          `${tool.name} has testStatus="${tool.testStatus ?? "unset"}" but no UNTESTED_TOOL_ALLOWLIST entry. Add one or fix the tool's tests.`,
        );
        continue;
      }

      const match = UNTESTED_NOTE_PATTERN.exec(note);
      if (!match) {
        failures.push(
          `${tool.name} allow-list entry "${note}" must match "PROD-NNN YYYY-MM-DD — reason".`,
        );
        continue;
      }

      const noted = new Date(match[1]);
      const ageDays = Math.floor((today.getTime() - noted.getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays > ALLOWLIST_FRESHNESS_DAYS) {
        failures.push(
          `${tool.name} allow-list entry is ${ageDays} days old (max ${ALLOWLIST_FRESHNESS_DAYS}). Re-test or refresh the note.`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(`AI tool allow-list violations:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
    }

    expect(failures).toEqual([]);
  });

  it("client-side tools are never executed on the server", () => {
    const clientSideToolNames = TOOL_METADATA.filter(
      (t) => t.clientSide === true || t.access === "client-side",
    ).map((t) => t.name);

    const offenders: string[] = [];
    for (const name of clientSideToolNames) {
      const exported = (allTools as Record<string, unknown>)[name] as
        | { execute?: unknown }
        | undefined;
      if (exported && typeof exported.execute === "function") {
        offenders.push(name);
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `Client-side tools must not define a server-side execute() function: ${offenders.join(", ")}`,
      );
    }

    expect(offenders).toEqual([]);
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

    const result = await tool.execute({ query: "pricing", limit: 3 }, toolOptions);

    expect(searchMeetings).toHaveBeenCalledWith("pricing", "user_a", 3);
    expect(result.results?.[0]).toMatchObject({ meetingId: "meeting_1", relevance: 91 });
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

    expect(tool.inputSchema.safeParse({ meetingId: "meeting_1" }).success).toBe(true);
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

    const result = await tool.execute({ meetingId: "meeting_1" }, toolOptions);

    expect(result).toMatchObject({
      id: "meeting_1",
      title: "Demo call",
      transcript: "Hello there",
      keyPoints: ["Budget"],
    });
  });

  it("listRecentMeetings validates limits and normalizes meeting rows", async () => {
    const tool = executable<
      { limit?: number },
      { meetings: Array<{ id: string; title: string; status: string }> }
    >(allTools.listRecentMeetings);

    expect(tool.inputSchema.safeParse({ limit: 5 }).success).toBe(true);
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

    const result = await tool.execute({ limit: 1 }, toolOptions);

    expect(list).toHaveBeenCalledWith(1);
    expect(result.meetings).toEqual([
      expect.objectContaining({ id: "meeting_1", title: "Untitled", status: "completed" }),
    ]);
  });

  it("codeReview detects security risks and validates input", async () => {
    const tool = executable<
      { code: string; language?: string },
      { critical: number; totalIssues: number }
    >(codeReview);

    expect(tool.inputSchema.safeParse({ code: "const x = 1;" }).success).toBe(true);
    expect(tool.inputSchema.safeParse({ language: "typescript" }).success).toBe(false);

    const result = await tool.execute({ code: "const value = eval(input);", language: "typescript" }, toolOptions);

    expect(result.critical).toBeGreaterThan(0);
    expect(result.totalIssues).toBeGreaterThan(0);
  });
});
