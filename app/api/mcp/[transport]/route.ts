import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getMeetingsStore } from "@/lib/meetings/store";
import { searchMeetings } from "@/lib/embeddings/search";
import { getCurrentUserId } from "@/lib/supabase/user";

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "search_meetings",
      "Search meeting transcripts and summaries using natural language. Returns ranked results by semantic similarity.",
      {
        query: z.string().describe("Natural language search query"),
        limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)"),
      },
      async ({ query, limit }) => {
        const userId = await getCurrentUserId();
        if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated" }] };
        const results = await searchMeetings(query, userId, limit ?? 10);
        return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
      },
    );

    server.tool(
      "get_meeting",
      "Get full details of a meeting including transcript, summary, and cost.",
      { meeting_id: z.string().describe("The meeting ID") },
      async ({ meeting_id }) => {
        const store = await getMeetingsStore();
        const meeting = await store.get(meeting_id);
        return {
          content: [{ type: "text" as const, text: meeting ? JSON.stringify(meeting, null, 2) : "Meeting not found" }],
        };
      },
    );

    server.tool(
      "list_meetings",
      "List recent meetings with status, title, and duration.",
      { limit: z.number().int().min(1).max(100).optional().describe("Max meetings (default 20)") },
      async ({ limit }) => {
        const store = await getMeetingsStore();
        const meetings = await store.list(limit ?? 20);
        return { content: [{ type: "text" as const, text: JSON.stringify(meetings, null, 2) }] };
      },
    );

    server.tool(
      "get_transcript",
      "Get the full transcript text of a meeting.",
      { meeting_id: z.string().describe("The meeting ID") },
      async ({ meeting_id }) => {
        const store = await getMeetingsStore();
        const meeting = await store.get(meeting_id);
        return { content: [{ type: "text" as const, text: meeting?.text ?? "No transcript available" }] };
      },
    );

    server.tool(
      "get_summary",
      "Get the AI-generated summary including key points, action items, decisions.",
      { meeting_id: z.string().describe("The meeting ID") },
      async ({ meeting_id }) => {
        const store = await getMeetingsStore();
        const meeting = await store.get(meeting_id);
        return {
          content: [{
            type: "text" as const,
            text: meeting?.summary ? JSON.stringify(meeting.summary, null, 2) : "No summary available",
          }],
        };
      },
    );
  },
  {
    serverInfo: {
      name: "layer-one-audio",
      version: "1.0.0",
    },
  },
  {
    basePath: "/api/mcp",
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
