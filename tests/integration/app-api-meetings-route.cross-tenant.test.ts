/**
 * PROD-322 -- Cross-tenant probes for /api/meetings and /api/meetings/[id].
 *
 * Critical security invariant: a request authenticated as user A must NEVER
 * see, read, or mutate user B's meetings. We seed a tenant-aware fake store
 * with one meeting per user, then drive the real route handlers (no
 * mock auth middleware) via mocked `getCurrentUserId` + `getMeetingsStore`.
 *
 * If a leak is found, mark the failing test `.skip()` with a comment
 * pointing at the new Linear ticket; do NOT silently fix the route.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fixtureUsers } from "../fixtures/users";

interface SeededMeeting {
  id: string;
  userId: string;
  title: string;
  status: "completed";
  durationSeconds: number;
  text: string | null;
  utterances: Array<{ speaker: string; text: string; start: number; end: number; confidence: number }>;
  summary: null;
  intakeForm: null;
  costBreakdown: null;
  error: null;
  createdAt: string;
  updatedAt: string;
}

const seeded: SeededMeeting[] = [];
let currentUserId: string | null = null;

function fakeStore() {
  return {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(async (id: string) => {
      const idx = seeded.findIndex(
        (m) => m.id === id && m.userId === currentUserId,
      );
      if (idx === -1) return false;
      seeded.splice(idx, 1);
      return true;
    }),
    get: vi.fn(async (id: string) => {
      // Tenant-scoped: only return rows owned by the caller.
      const row = seeded.find(
        (m) => m.id === id && m.userId === currentUserId,
      );
      return row ?? null;
    }),
    list: vi.fn(async (limit: number) => {
      return seeded
        .filter((m) => m.userId === currentUserId)
        .slice(0, limit)
        .map(({ id, status, title, durationSeconds, createdAt }) => ({
          id,
          status,
          title,
          durationSeconds,
          createdAt,
        }));
    }),
  };
}

const storeInstance = fakeStore();

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  getSupabaseUser: vi.fn(),
  getMeetingsStore: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getSupabaseUser: mocks.getSupabaseUser,
}));

vi.mock("@/lib/meetings/store", () => ({
  getMeetingsStore: mocks.getMeetingsStore,
}));

const meetingsRoute = await import("@/app/api/meetings/route");
const meetingByIdRoute = await import("@/app/api/meetings/[id]/route");

function jsonRequest(path: string, method: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { "content-type": "application/json", "x-request-id": "req_xt" },
  });
}

function withParams(id: string) {
  return {
    requestId: "req_xt",
    startedAt: Date.now(),
    params: { id },
  };
}

const meetingA: SeededMeeting = {
  id: "meeting_a_only",
  userId: fixtureUsers.owner.id,
  title: "User A roadmap call",
  status: "completed",
  durationSeconds: 1800,
  text: "Roadmap notes for user A only.",
  utterances: [
    {
      speaker: "Alex",
      text: "Roadmap notes for user A only.",
      start: 0,
      end: 4200,
      confidence: 0.97,
    },
  ],
  summary: null,
  intakeForm: null,
  costBreakdown: null,
  error: null,
  createdAt: "2026-04-30T10:00:00.000Z",
  updatedAt: "2026-04-30T10:30:00.000Z",
};

const meetingB: SeededMeeting = {
  id: "meeting_b_only",
  userId: fixtureUsers.intruder.id,
  title: "User B confidential strategy",
  status: "completed",
  durationSeconds: 2400,
  text: "Confidential strategy notes for user B only.",
  utterances: [
    {
      speaker: "Sam",
      text: "Confidential strategy notes for user B only.",
      start: 0,
      end: 5000,
      confidence: 0.95,
    },
  ],
  summary: null,
  intakeForm: null,
  costBreakdown: null,
  error: null,
  createdAt: "2026-04-30T11:00:00.000Z",
  updatedAt: "2026-04-30T11:30:00.000Z",
};

describe("PROD-322 -- /api/meetings cross-tenant isolation", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    seeded.length = 0;
    seeded.push({ ...meetingA }, { ...meetingB });
    currentUserId = null;

    mocks.getCurrentUserId.mockImplementation(async () => currentUserId);
    mocks.getMeetingsStore.mockResolvedValue(storeInstance);
  });

  it("GET /api/meetings as user A returns ONLY user A's meetings", async () => {
    currentUserId = fixtureUsers.owner.id;

    const res = await meetingsRoute.GET(jsonRequest("/api/meetings", "GET"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req_xt");
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: meetingA.id,
      title: meetingA.title,
    });
    // Hard guard: user B's meeting must not appear.
    expect(body.some((m: { id: string }) => m.id === meetingB.id)).toBe(false);
  });

  it("GET /api/meetings as user B returns ONLY user B's meetings", async () => {
    currentUserId = fixtureUsers.intruder.id;

    const res = await meetingsRoute.GET(jsonRequest("/api/meetings", "GET"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(meetingB.id);
    expect(body.some((m: { id: string }) => m.id === meetingA.id)).toBe(false);
  });

  it("GET /api/meetings/<B_id> as user A returns 404 (no leak of B's data)", async () => {
    currentUserId = fixtureUsers.owner.id;

    const res = await meetingByIdRoute.GET(
      jsonRequest(`/api/meetings/${meetingB.id}`, "GET"),
      withParams(meetingB.id),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toMatchObject({ error: "Meeting not found" });
    // No fields from B's meeting should leak into the body.
    expect(JSON.stringify(body)).not.toContain("Confidential strategy");
  });

  it("DELETE /api/meetings/<B_id> as user A returns 404 and B's meeting still exists", async () => {
    currentUserId = fixtureUsers.owner.id;

    const res = await meetingByIdRoute.DELETE(
      jsonRequest(`/api/meetings/${meetingB.id}`, "DELETE"),
      withParams(meetingB.id),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toMatchObject({ error: "Meeting not found" });
    // B's meeting must still be in the store.
    expect(seeded.some((m) => m.id === meetingB.id)).toBe(true);
  });

  it("GET /api/meetings/<A_id> as user A returns A's meeting", async () => {
    currentUserId = fixtureUsers.owner.id;

    const res = await meetingByIdRoute.GET(
      jsonRequest(`/api/meetings/${meetingA.id}`, "GET"),
      withParams(meetingA.id),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      id: meetingA.id,
      title: meetingA.title,
    });
  });
});
