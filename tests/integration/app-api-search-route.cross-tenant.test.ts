/**
 * PROD-322 -- Cross-tenant probes for /api/search.
 *
 * Critical security invariant: a search authenticated as user A must NEVER
 * surface chunks from user B's meetings, even if the query string only
 * matches phrases in B's content. We seed two meetings (one per user) where
 * the search phrase is uniquely present in B's meeting, then confirm A's
 * query returns 0 results.
 *
 * The route first calls `searchMeetings(query, userId, limit)` (semantic),
 * then falls back to a direct Supabase ilike query filtered by user_id. We
 * mock both layers with tenant-aware fakes that respect user_id.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fixtureUsers } from "../fixtures/users";

interface SeededChunk {
  meetingId: string;
  userId: string;
  meetingTitle: string;
  chunkText: string;
  meetingDate: string;
}

const seededChunks: SeededChunk[] = [];
let currentUserId: string | null = null;

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  searchMeetings: vi.fn(),
  getSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getSupabaseUser: vi.fn(),
}));

vi.mock("@/lib/embeddings/search", () => ({
  searchMeetings: mocks.searchMeetings,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: mocks.getSupabaseServer,
}));

const searchRoute = await import("@/app/api/search/route");

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "req_xts" },
    body: JSON.stringify(body),
  });
}

const userAChunk: SeededChunk = {
  meetingId: "meeting_a",
  userId: fixtureUsers.owner.id,
  meetingTitle: "User A roadmap",
  chunkText: "User A discussed the next sprint backlog.",
  meetingDate: "2026-04-30T10:00:00.000Z",
};

const userBChunk: SeededChunk = {
  meetingId: "meeting_b",
  userId: fixtureUsers.intruder.id,
  meetingTitle: "User B strategy",
  chunkText:
    "User B reviewed the secret hummingbird launch codename internally.",
  meetingDate: "2026-04-30T11:00:00.000Z",
};

const SECRET_PHRASE = "hummingbird";

function tenantAwareSemanticSearch(query: string, userId: string, limit?: number) {
  const lower = query.toLowerCase();
  return seededChunks
    .filter(
      (c) =>
        c.userId === userId &&
        (c.chunkText.toLowerCase().includes(lower) ||
          c.meetingTitle.toLowerCase().includes(lower)),
    )
    .slice(0, limit ?? 10)
    .map((c) => ({
      meetingId: c.meetingId,
      chunkText: c.chunkText,
      chunkType: "summary",
      similarity: 0.9,
      meetingTitle: c.meetingTitle,
      meetingDate: c.meetingDate,
    }));
}

function tenantAwareSupabase() {
  // Tracks every .eq() call so we can prove the route filters by user_id.
  const eqCalls: Array<[string, unknown]> = [];
  let pendingUserFilter: string | null = null;

  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn((column: string, value: unknown) => {
    eqCalls.push([column, value]);
    if (column === "user_id" && typeof value === "string") {
      pendingUserFilter = value;
    }
    return query;
  });
  query.or = vi.fn((expr: string) => {
    // Simulate ilike: extract the phrase.
    const match = expr.match(/text\.ilike\.%([^%]+)%/);
    const phrase = match?.[1]?.toLowerCase() ?? "";
    const data = seededChunks
      .filter(
        (c) =>
          (pendingUserFilter === null || c.userId === pendingUserFilter) &&
          (c.meetingTitle.toLowerCase().includes(phrase) ||
            c.chunkText.toLowerCase().includes(phrase)),
      )
      .map((c) => ({
        id: c.meetingId,
        title: c.meetingTitle,
        text: c.chunkText,
        status: "completed",
        created_at: c.meetingDate,
      }));
    query._pendingData = data;
    return query;
  });
  query.order = vi.fn(() => query);
  query.limit = vi.fn(async (_n: number) => ({
    data: query._pendingData ?? [],
    error: null,
  }));

  return {
    from: vi.fn(() => query),
    _eqCalls: eqCalls,
  };
}

describe("PROD-322 -- /api/search cross-tenant isolation", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    seededChunks.length = 0;
    seededChunks.push({ ...userAChunk }, { ...userBChunk });
    currentUserId = null;

    mocks.getCurrentUserId.mockImplementation(async () => currentUserId);
    mocks.searchMeetings.mockImplementation(tenantAwareSemanticSearch);
    mocks.getSupabaseServer.mockImplementation(() => tenantAwareSupabase());
  });

  it("POST /api/search as user A for a phrase only in B's meeting returns 0 results", async () => {
    currentUserId = fixtureUsers.owner.id;

    const res = await searchRoute.POST(
      jsonRequest({ query: SECRET_PHRASE, limit: 10 }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req_xts");
    expect(body.results).toEqual([]);
    // Whatever mode the route chose (semantic or text), the body must not
    // contain a meeting from user B.
    expect(JSON.stringify(body)).not.toContain(userBChunk.meetingId);
    expect(JSON.stringify(body)).not.toContain(SECRET_PHRASE);
    // Semantic search must have been invoked with user A's id.
    expect(mocks.searchMeetings).toHaveBeenCalledWith(
      SECRET_PHRASE,
      fixtureUsers.owner.id,
      10,
    );
  });

  it("POST /api/search as user B for the same phrase returns B's chunk", async () => {
    currentUserId = fixtureUsers.intruder.id;

    const res = await searchRoute.POST(
      jsonRequest({ query: SECRET_PHRASE, limit: 10 }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe("semantic");
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({ meetingId: userBChunk.meetingId });
  });

  it("POST /api/search returns 401 without an authenticated user", async () => {
    currentUserId = null;

    const res = await searchRoute.POST(jsonRequest({ query: "anything" }));

    expect(res.status).toBe(401);
    expect(mocks.searchMeetings).not.toHaveBeenCalled();
  });

  it("POST /api/search text-fallback path filters Supabase by user_id", async () => {
    currentUserId = fixtureUsers.owner.id;
    // Force semantic to return nothing so the route falls through to text.
    mocks.searchMeetings.mockResolvedValueOnce([]);

    const supabaseInstance = tenantAwareSupabase();
    mocks.getSupabaseServer.mockReturnValueOnce(supabaseInstance);

    const res = await searchRoute.POST(
      jsonRequest({ query: SECRET_PHRASE, limit: 5 }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    // Text-fallback must filter by user_id == A and find no rows for A.
    expect(supabaseInstance._eqCalls).toEqual(
      expect.arrayContaining([["user_id", fixtureUsers.owner.id]]),
    );
    expect(body.results).toEqual([]);
  });
});
