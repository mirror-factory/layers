/**
 * PROD-403 -- /api/account/api-keys lifecycle.
 *
 * Scaffolded power-user surface for headless server-to-server access.
 * The default integration path is OAuth + DCR; this route exists so the
 * UI can mint, list, and revoke `layers_pat_*` bearers when OAuth isn't
 * an option.
 *
 * Key contract assertions:
 *   - Plaintext is returned EXACTLY ONCE from POST.
 *   - The DB stores only `token_hash` (sha256) + `token_prefix`, never plaintext.
 *   - Revoke flips `revoked_at`; idempotent on already-revoked rows.
 *   - Auth gating on every method.
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

const apiKeysRoute = await import("@/app/api/account/api-keys/route");
const apiKeyIdRoute = await import("@/app/api/account/api-keys/[id]/route");

function jsonRequest(path: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { "content-type": "application/json", "x-request-id": "req_test" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

interface FakeKeyRow {
  id: string;
  user_id: string;
  name: string | null;
  token_hash: string;
  token_prefix: string;
  scope: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function buildSupabaseFake(seed: FakeKeyRow[] = []) {
  const rows = [...seed];

  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let pendingInsert: Record<string, unknown> | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;
      let selectCols = "";

      const builder = {
        select(cols: string) {
          selectCols = cols;
          return builder;
        },
        insert(row: Record<string, unknown>) {
          pendingInsert = row;
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
        order(_col: string, _opts: unknown) {
          return builder;
        },
        async maybeSingle() {
          if (table !== "api_keys") return { data: null, error: null };
          const row = rows.find(
            (r) =>
              (filters.id === undefined || r.id === filters.id) &&
              (filters.user_id === undefined || r.user_id === filters.user_id),
          );
          if (row && pendingUpdate) Object.assign(row, pendingUpdate);
          return { data: row ?? null, error: null };
        },
        async single() {
          if (pendingInsert) {
            const newRow: FakeKeyRow = {
              id: `key_${rows.length + 1}`,
              user_id: pendingInsert.user_id as string,
              name: (pendingInsert.name as string | null) ?? null,
              token_hash: pendingInsert.token_hash as string,
              token_prefix: pendingInsert.token_prefix as string,
              scope: (pendingInsert.scope as string) ?? "mcp:tools",
              created_at: new Date().toISOString(),
              last_used_at: null,
              revoked_at: null,
            };
            rows.push(newRow);
            void selectCols;
            return { data: newRow, error: null };
          }
          return builder.maybeSingle();
        },
        then(onFulfilled: (v: { data: FakeKeyRow[]; error: null }) => unknown) {
          if (table !== "api_keys") {
            return Promise.resolve({ data: [], error: null }).then(onFulfilled);
          }
          if (pendingUpdate) {
            for (const row of rows) {
              if (
                (filters.id === undefined || row.id === filters.id) &&
                (filters.user_id === undefined || row.user_id === filters.user_id)
              ) {
                Object.assign(row, pendingUpdate);
              }
            }
            return Promise.resolve({ data: [], error: null }).then(onFulfilled);
          }
          const matched = rows.filter(
            (r) =>
              (filters.id === undefined || r.id === filters.id) &&
              (filters.user_id === undefined || r.user_id === filters.user_id),
          );
          return Promise.resolve({ data: matched, error: null }).then(onFulfilled);
        },
      };
      return builder;
    },
    __rows: rows,
  };
}

describe("PROD-403 -- /api/account/api-keys", () => {
  beforeEach(() => {
    mocks.getCurrentUserId.mockReset();
    mocks.getSupabaseServer.mockReset();
  });

  describe("GET", () => {
    it("requires an authenticated user", async () => {
      mocks.getCurrentUserId.mockResolvedValue(null);

      const res = await apiKeysRoute.GET(
        jsonRequest("/api/account/api-keys", "GET"),
        {} as never,
      );

      expect(res.status).toBe(401);
    });

    it("returns the caller's keys", async () => {
      mocks.getCurrentUserId.mockResolvedValue("user_a");
      mocks.getSupabaseServer.mockReturnValue(
        buildSupabaseFake([
          {
            id: "key_1",
            user_id: "user_a",
            name: "CI",
            token_hash: "h1",
            token_prefix: "layers_pat_aaaa",
            scope: "mcp:tools",
            created_at: "2026-04-30T12:00:00.000Z",
            last_used_at: null,
            revoked_at: null,
          },
        ]),
      );

      const res = await apiKeysRoute.GET(
        jsonRequest("/api/account/api-keys", "GET"),
        {} as never,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { keys: Array<{ id: string }> };
      expect(body.keys).toHaveLength(1);
      expect(body.keys[0].id).toBe("key_1");
    });
  });

  describe("POST", () => {
    it("requires an authenticated user", async () => {
      mocks.getCurrentUserId.mockResolvedValue(null);

      const res = await apiKeysRoute.POST(
        jsonRequest("/api/account/api-keys", "POST", { name: "CI" }),
        {} as never,
      );

      expect(res.status).toBe(401);
    });

    it("mints a key, returns plaintext once, persists only the hash", async () => {
      mocks.getCurrentUserId.mockResolvedValue("user_a");
      const fake = buildSupabaseFake([]);
      mocks.getSupabaseServer.mockReturnValue(fake);

      const res = await apiKeysRoute.POST(
        jsonRequest("/api/account/api-keys", "POST", { name: "CI" }),
        {} as never,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        plaintext: string;
        key: { tokenPrefix: string; name: string | null };
      };

      // Plaintext is returned once and follows our prefix contract.
      expect(body.plaintext).toMatch(/^layers_pat_/);
      // The persisted row carries the hash, NOT the plaintext.
      expect(fake.__rows[0].token_hash).not.toBe(body.plaintext);
      expect(fake.__rows[0].token_hash.length).toBeGreaterThan(40);
      // Prefix returned to the UI matches what's persisted.
      expect(body.key.tokenPrefix).toBe(fake.__rows[0].token_prefix);
      expect(body.key.name).toBe("CI");
    });
  });

  describe("DELETE", () => {
    it("requires an authenticated user", async () => {
      mocks.getCurrentUserId.mockResolvedValue(null);

      const res = await apiKeyIdRoute.DELETE(
        jsonRequest("/api/account/api-keys/key_1", "DELETE"),
        { params: Promise.resolve({ id: "key_1" }) } as never,
      );

      expect(res.status).toBe(401);
    });

    it("flips revoked_at on the caller's key", async () => {
      mocks.getCurrentUserId.mockResolvedValue("user_a");
      const fake = buildSupabaseFake([
        {
          id: "key_1",
          user_id: "user_a",
          name: "CI",
          token_hash: "h1",
          token_prefix: "layers_pat_aaaa",
          scope: "mcp:tools",
          created_at: "2026-04-30T12:00:00.000Z",
          last_used_at: null,
          revoked_at: null,
        },
      ]);
      mocks.getSupabaseServer.mockReturnValue(fake);

      const res = await apiKeyIdRoute.DELETE(
        jsonRequest("/api/account/api-keys/key_1", "DELETE"),
        { params: Promise.resolve({ id: "key_1" }) } as never,
      );

      expect(res.status).toBe(200);
      expect(fake.__rows[0].revoked_at).not.toBeNull();
    });

    it("404s on a foreign-owned key id", async () => {
      mocks.getCurrentUserId.mockResolvedValue("user_a");
      mocks.getSupabaseServer.mockReturnValue(
        buildSupabaseFake([
          {
            id: "key_other",
            user_id: "user_b",
            name: null,
            token_hash: "h2",
            token_prefix: "layers_pat_xxxx",
            scope: "mcp:tools",
            created_at: "2026-04-30T12:00:00.000Z",
            last_used_at: null,
            revoked_at: null,
          },
        ]),
      );

      const res = await apiKeyIdRoute.DELETE(
        jsonRequest("/api/account/api-keys/key_other", "DELETE"),
        { params: Promise.resolve({ id: "key_other" }) } as never,
      );

      expect(res.status).toBe(404);
    });
  });
});
