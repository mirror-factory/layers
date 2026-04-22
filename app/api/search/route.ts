export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { searchMeetings } from "@/lib/embeddings/search";
import { getCurrentUserId } from "@/lib/supabase/user";
import { getSupabaseServer } from "@/lib/supabase/server";

const SearchBodySchema = z.object({
  query: z.string().min(1, "query is required"),
  limit: z.number().int().min(1).max(50).optional(),
});

export const POST = withRoute(async (req) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let body: z.infer<typeof SearchBodySchema>;
  try {
    const raw = await req.json();
    body = SearchBodySchema.parse(raw);
  } catch (err) {
    const zodErrors = err instanceof z.ZodError ? err.issues : null;
    return NextResponse.json(
      { error: zodErrors ?? "Invalid request body" },
      { status: 400 },
    );
  }

  // Try semantic/hybrid search first
  const semanticResults = await searchMeetings(body.query, userId, body.limit);

  if (semanticResults.length > 0) {
    return NextResponse.json({ results: semanticResults, mode: "semantic" });
  }

  // Fallback: basic text search on the meetings table directly
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ results: [], mode: "none" });
  }

  const { data: textResults } = await supabase
    .from("meetings")
    .select("id, title, text, status, created_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .or(`title.ilike.%${body.query}%,text.ilike.%${body.query}%`)
    .order("created_at", { ascending: false })
    .limit(body.limit ?? 10);

  const results = (textResults ?? []).map((m: { id: string; title: string | null; text: string | null; created_at: string }) => ({
    meetingId: m.id,
    chunkText: m.text?.substring(0, 200) ?? "",
    chunkType: "full-text",
    similarity: 1,
    meetingTitle: m.title,
    meetingDate: m.created_at,
  }));

  return NextResponse.json({ results, mode: "text" });
});
