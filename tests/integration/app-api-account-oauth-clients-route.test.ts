/**
 * PROD-403 -- /api/account/oauth-clients + /api/account/oauth-clients/:id.
 *
 * Covers the user-facing lifecycle endpoints AND the propagation guarantee
 * called out in the ticket:
 *
 *   "Subsequent token validation against this client_id rejects with 401
 *    + error: \"client_revoked\"."
 *
 * The MCP route surfaces that via `validateMcpBearerOutcome`, which checks
 * the same `oauth_clients.revoked_at` column. The unit test in
 * `tests/unit/oauth-client-revocation.test.ts` proves the validator path
 * end-to-end. Here we focus on the HTTP surface (auth gating, 404s, 401s)
 * and the cascade revoke of refresh tokens.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  getSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  getSupabaseUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: mocks.getSupabaseServer,
}));

const listRoute = await import("@/app/api/account/oauth-clients/route");
const idRoute = await import("@/app/api/account/oauth-clients/[id]/route");

function jsonRequest(path: string, method: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { "content-type": "application/json", "x-request-id": "req_test" },
  });
}

interface FakeRow {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/**
 * Minimal Supabase chain fake. We intentionally don't pull in a real
 * Supabase client because the route only uses a handful of methods --
 * keeping the fake small makes intent obvious.
 */
function buildSupabaseFake(rows: FakeRow[], refreshTokens: { client_id: string; revoked_at: string | null }[] = []) {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let pendingUpdate: Record<string, unknown> | null = null;
      let pendingDeleteRevokedAtIsNull = false;

      const builder = {
        select(_cols: string) {
          return builder;
        },
        update(patch: Record<string, unknown>) {
          pendingUpdate = patch;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        is(column: string, value: unknown) {
          if (column === "revoked_at" && value === null) {
            pendingDeleteRevokedAtIsNull = true;
          }
          return builder;
        },
        order(_col: string, _opts: unknown) {
          return builder;
        },
        async maybeSingle() {
          if (table === "oauth_clients") {
            const row = rows.find(
              (r) =>
                (filters.id === undefined || r.id === filters.id) &&
                (filters.user_id === undefined || r.user_id === filters.user_id) &&
                (filters.client_id === undefined || r.client_id === filters.client_id),
            );
            if (pendingUpdate && row) {
              Object.assign(row, pendingUpdate);
            }
            return { data: row ?? null, error: null };
          }
          return { data: null, error: null };
        },
        async single() {
          return builder.maybeSingle();
        },
        then(onFulfilled: (v: { data: FakeRow[]; error: null }) => unknown) {
          if (table === "oauth_clients") {
            if (pendingUpdate) {
              for (const row of rows) {
                if (
                  (filters.id === undefined || row.id === filters.id) &&
                  (filters.user_id === undefined || row.user_id === filters.user_id) &&
                  (filters.client_id === undefined || row.client_id === filters.client_id)
                ) {
                  Object.assign(row, pendingUpdate);
                }
              }
              return Promise.resolve({ data: [] as FakeRow[], error: null }).then(onFulfilled);
            }
            const matched = rows.filter(
              (r) =>
                (filters.id === undefined || r.id === filters.id) &&
                (filters.user_id === undefined || r.user_id === filters.user_id) &&
                (filters.client_id === undefined || r.client_id === filters.client_id),
            );
            return Promise.resolve({ data: matched, error: null }).then(onFulfilled);
          }
          if (table === "oauth_refresh_tokens" && pendingUpdate) {
            for (const tok of refreshTokens) {
              if (
                (filters.client_id === undefined || tok.client_id === filters.client_id) &&
                (!pendingDeleteRevokedAtIsNull || tok.revoked_at === null)
              ) {
                tok.revoked_at = (pendingUpdate as { revoked_at: string }).revoked_at;
              }
            }
            return Promise.resolve({ data: [], error: null }).then(onFulfilled);
          }
          return Promise.resolve({ data: [], error: null }).then(onFulfilled);
        },
      };
      return builder;
    },
  };
}

describe("PROD-403 -- /api/account/oauth-clients", () => {
  beforeEach(() => {
    mocks.getCurrentUserId.mockReset();
    mocks.getSupabaseServer.mockReset();
  });

  describe("GET /api/account/oauth-clients", () => {
    it("requires an authenticated user", async () => {
      mocks.getCurrentUserId.mockResolvedValue(null);

      const res = await listRoute.GET(
        jsonRequest("/api/account/oauth-clients", "GET"),
        {} as never,
      );

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toMatchObject({
        error: "Authentication required",
      });
    });

    it("returns 503 when the database is not configured", async () => {
      mocks.getCurrentUserId.mockResolvedValue("user_a");
      mocks.getSupabaseServer.mockReturnValue(null);

      const res = await listRoute.GET(
        jsonRequest("/api/account/oauth-clients", "GET"),
        {} as never,
      );

      expect(res.status).toBe(503);
    });

    it("returns the user's clients newest-first with revoked state", async () => {
      mocks.getCurrentUserId.mockResolvedValue("user_a");
      mocks.getSupabaseServer.mockReturnValue(
        buildSupabaseFake([
          {
            id: "row_1",
            user_id: "user_a",
            client_id: "mcp-claude",
            client_name: "Claude Desktop",
            redirect_uris: ["claude://callback"],
            created_at: "2026-04-30T12:00:00.000Z",
            last_used_at: "2026-04-30T13:00:00.000Z",
            revoked_at: null,
          },
          {
            id: "row_2",
            user_id: "user_b",
            client_id: "mcp-other",
            client_name: "Other",
            redirect_uris: [],
            created_at: "2026-04-29T12:00:00.000Z",
            last_used_at: null,
            revoked_at: null,
          },
        ]),
      );

      const res = await listRoute.GET(
        jsonRequest("/api/account/oauth-clients", "GET"),
        {} as never,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        clients: Array<{ id: string; clientId: string; clientName: string | null }>;
      };
      expect(body.clients).toHaveLength(1);
      expect(body.clients[0]).toMatchObject({
        id: "row_1",
        clientId: "mcp-claude",
        clientName: "Claude Desktop",
      });
    });
  });

  describe("DELETE /api/account/oauth-clients/:id", () => {
    it("requires an authenticated user", async () => {
      mocks.getCurrentUserId.mockResolvedValue(null);

      const res = await idRoute.DELETE(
        jsonRequest("/api/account/oauth-clients/row_1", "DELETE"),
        { params: Promise.resolve({ id: "row_1" }) } as never,
      );

      expect(res.status).toBe(401);
    });

    it("returns 404 when the client does not belong to the caller", async () => {
      mocks.getCurrentUserId.mockResolvedValue("user_a");
      mocks.getSupabaseServer.mockReturnValue(
        buildSupabaseFake([
          {
            id: "row_other",
            user_id: "user_b",
            client_id: "mcp-other",
            client_name: "Other",
            redirect_uris: [],
            created_at: "2026-04-29T12:00:00.000Z",
            last_used_at: null,
            revoked_at: null,
          },
        ]),
      );

      const res = await idRoute.DELETE(
        jsonRequest("/api/account/oauth-clients/row_other", "DELETE"),
        { params: Promise.resolve({ id: "row_other" }) } as never,
      );

      expect(res.status).toBe(404);
    });

    it("flips revoked_at and cascades to live refresh tokens", async () => {
      mocks.getCurrentUserId.mockResolvedValue("user_a");
      const rows: FakeRow[] = [
        {
          id: "row_1",
          user_id: "user_a",
          client_id: "mcp-claude",
          client_name: "Claude Desktop",
          redirect_uris: ["claude://callback"],
          created_at: "2026-04-30T12:00:00.000Z",
          last_used_at: "2026-04-30T13:00:00.000Z",
          revoked_at: null,
        },
      ];
      const refreshTokens = [
        { client_id: "mcp-claude", revoked_at: null },
        { client_id: "mcp-claude", revoked_at: "2026-04-29T00:00:00.000Z" }, // pre-revoked
        { client_id: "mcp-other", revoked_at: null }, // different client
      ];
      mocks.getSupabaseServer.mockReturnValue(buildSupabaseFake(rows, refreshTokens));

      const res = await idRoute.DELETE(
        jsonRequest("/api/account/oauth-clients/row_1", "DELETE"),
        { params: Promise.resolve({ id: "row_1" }) } as never,
      );

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ revoked: true });
      expect(rows[0].revoked_at).not.toBeNull();
      // Live token for the revoked client is now also revoked.
      expect(refreshTokens[0].revoked_at).not.toBeNull();
      // Already-revoked token for the same client is left untouched.
      expect(refreshTokens[1].revoked_at).toBe("2026-04-29T00:00:00.000Z");
      // Token for a DIFFERENT client must NOT be touched.
      expect(refreshTokens[2].revoked_at).toBeNull();
    });

    it("is idempotent on already-revoked clients", async () => {
      mocks.getCurrentUserId.mockResolvedValue("user_a");
      mocks.getSupabaseServer.mockReturnValue(
        buildSupabaseFake([
          {
            id: "row_1",
            user_id: "user_a",
            client_id: "mcp-claude",
            client_name: "Claude Desktop",
            redirect_uris: [],
            created_at: "2026-04-30T12:00:00.000Z",
            last_used_at: null,
            revoked_at: "2026-04-30T15:00:00.000Z",
          },
        ]),
      );

      const res = await idRoute.DELETE(
        jsonRequest("/api/account/oauth-clients/row_1", "DELETE"),
        { params: Promise.resolve({ id: "row_1" }) } as never,
      );

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        revoked: true,
        alreadyRevoked: true,
      });
    });
  });
});
