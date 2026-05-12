/**
 * PROD-403 -- unit: revocation propagates to MCP bearer validation.
 *
 * Acceptance criterion: "Subsequent token validation against this client_id
 * rejects with 401 + error: client_revoked".
 *
 * The MCP route surfaces that via `validateMcpBearerOutcome` -> {kind:"revoked"}.
 * This test signs a real JWT with a `client_id` claim, drives it through the
 * REAL validator (not a mock), and asserts:
 *
 *   1. With no oauth_clients row     -> {kind:"ok"} (legacy / first-time hit)
 *   2. With a row, revoked_at = null -> {kind:"ok"}
 *   3. With a row, revoked_at = now  -> {kind:"revoked"}
 *
 * That's the contract the DELETE endpoint relies on -- flip the column and
 * the next bearer validation fails differently.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import {
  getMcpJwtSecret,
  MCP_OAUTH_AUDIENCE,
  MCP_OAUTH_ISSUER,
  MCP_OAUTH_SCOPE,
} from "@/lib/oauth/mcp-oauth";

const mocks = vi.hoisted(() => ({
  getSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: mocks.getSupabaseServer,
}));

const { validateMcpBearerOutcome } = await import("@/lib/mcp/auth");

interface OAuthClientRow {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function buildSupabaseFake(rows: OAuthClientRow[]) {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder = {
        select(_cols: string) {
          return builder;
        },
        update(_patch: Record<string, unknown>) {
          // No-op for touch().
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        async maybeSingle() {
          if (table !== "oauth_clients") return { data: null, error: null };
          const row = rows.find(
            (r) =>
              (filters.client_id === undefined || r.client_id === filters.client_id) &&
              (filters.user_id === undefined || r.user_id === filters.user_id),
          );
          return { data: row ?? null, error: null };
        },
        then(onFulfilled: (v: { data: never[]; error: null }) => unknown) {
          return Promise.resolve({ data: [] as never[], error: null }).then(onFulfilled);
        },
      };
      return builder;
    },
  };
}

async function signTokenWithClientId(clientId: string | null) {
  const payload: Record<string, unknown> = {
    sub: "user_a",
    scope: MCP_OAUTH_SCOPE,
  };
  if (clientId) payload.client_id = clientId;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .setIssuer(MCP_OAUTH_ISSUER)
    .setAudience(MCP_OAUTH_AUDIENCE)
    .sign(getMcpJwtSecret());
}

describe("PROD-403 -- oauth_clients revocation propagation", () => {
  beforeEach(() => {
    mocks.getSupabaseServer.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a token whose client_id has no persisted row yet", async () => {
    // No row in oauth_clients == legacy / first-time bearer.
    // Validation must NOT reject -- that path is exclusively for
    // explicitly-revoked clients.
    mocks.getSupabaseServer.mockReturnValue(buildSupabaseFake([]));
    const token = await signTokenWithClientId("mcp-fresh");

    const outcome = await validateMcpBearerOutcome(token);
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.userId).toBe("user_a");
      expect(outcome.clientId).toBe("mcp-fresh");
    }
  });

  it("accepts a token whose oauth_clients row has revoked_at = null", async () => {
    mocks.getSupabaseServer.mockReturnValue(
      buildSupabaseFake([
        {
          id: "row_1",
          user_id: "user_a",
          client_id: "mcp-claude",
          client_name: "Claude Desktop",
          redirect_uris: ["claude://callback"],
          created_at: "2026-04-30T12:00:00.000Z",
          last_used_at: null,
          revoked_at: null,
        },
      ]),
    );
    const token = await signTokenWithClientId("mcp-claude");

    const outcome = await validateMcpBearerOutcome(token);
    expect(outcome.kind).toBe("ok");
  });

  it("rejects a token whose oauth_clients row has revoked_at set", async () => {
    // This is the acceptance criterion: revoke -> next bearer = client_revoked.
    mocks.getSupabaseServer.mockReturnValue(
      buildSupabaseFake([
        {
          id: "row_1",
          user_id: "user_a",
          client_id: "mcp-claude",
          client_name: "Claude Desktop",
          redirect_uris: ["claude://callback"],
          created_at: "2026-04-30T12:00:00.000Z",
          last_used_at: null,
          revoked_at: "2026-04-30T15:00:00.000Z",
        },
      ]),
    );
    const token = await signTokenWithClientId("mcp-claude");

    const outcome = await validateMcpBearerOutcome(token);
    expect(outcome.kind).toBe("revoked");
  });

  it("does not check oauth_clients when the JWT lacks a client_id claim", async () => {
    // Legacy tokens issued before PROD-403 don't carry `client_id`. They
    // remain valid -- the only way to invalidate them is to wait for
    // `exp` or revoke the refresh token directly. The DB layer should
    // not even be queried in this case.
    let dbHits = 0;
    mocks.getSupabaseServer.mockImplementation(() => {
      dbHits += 1;
      return buildSupabaseFake([]);
    });
    const token = await signTokenWithClientId(null);

    const outcome = await validateMcpBearerOutcome(token);
    expect(outcome.kind).toBe("ok");
    // The supabase getter should never have been called because there
    // is no client_id to look up.
    expect(dbHits).toBe(0);
  });
});
