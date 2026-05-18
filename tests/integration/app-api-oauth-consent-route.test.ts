/**
 * PROD-403 -- /api/oauth/consent now persists `oauth_clients` rows on the
 * first successful authorization (NOT on register POST). This test pins
 * that behavior so a future refactor doesn't accidentally revert to the
 * stateless-only model.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSupabaseUser: vi.fn(),
  getSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({
  getCurrentUserId: vi.fn(),
  getSupabaseUser: mocks.getSupabaseUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: mocks.getSupabaseServer,
}));

const consentRoute = await import("@/app/api/oauth/consent/route");

function formRequest(form: Record<string, string>): NextRequest {
  const body = new URLSearchParams(form);
  return new NextRequest("http://localhost:3000/api/oauth/consent", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-request-id": "req_consent_test",
    },
    body: body.toString(),
  });
}

function pkceFixture() {
  // Pre-baked PKCE pair so we don't have to compute SHA-256 in tests --
  // these values come from RFC 7636 Appendix B.
  return {
    code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  };
}

interface InsertedOAuthClient {
  user_id: string;
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
}

function buildSupabaseServerFake() {
  const insertedClients: InsertedOAuthClient[] = [];
  const insertedCodes: Record<string, unknown>[] = [];

  const fake = {
    from(table: string) {
      const builder = {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          if (table === "oauth_codes") {
            insertedCodes.push(row);
            return { error: null };
          }
          return { error: null };
        }),
        upsert: vi.fn(async (row: Record<string, unknown>) => {
          if (table === "oauth_clients") {
            insertedClients.push({
              user_id: row.user_id as string,
              client_id: row.client_id as string,
              client_name: (row.client_name as string | null) ?? null,
              redirect_uris: row.redirect_uris as string[],
            });
            return { error: null };
          }
          return { error: null };
        }),
      };
      return builder;
    },
    __insertedClients: insertedClients,
    __insertedCodes: insertedCodes,
  };
  return fake;
}

describe("PROD-403 -- /api/oauth/consent persists oauth_clients", () => {
  beforeEach(() => {
    mocks.getSupabaseUser.mockReset();
    mocks.getSupabaseServer.mockReset();
  });

  it("upserts an oauth_clients row when the user clicks Allow", async () => {
    const { code_challenge } = pkceFixture();

    mocks.getSupabaseUser.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: "user_a", is_anonymous: false } },
          error: null,
        }),
      },
    });
    const fake = buildSupabaseServerFake();
    mocks.getSupabaseServer.mockReturnValue(fake);

    const res = await consentRoute.POST(
      formRequest({
        decision: "allow",
        response_type: "code",
        redirect_uri: "https://claude.ai/callback",
        state: "state_xyz",
        code_challenge,
        code_challenge_method: "S256",
        scope: "mcp:tools",
        client_id: "mcp-claude",
        client_name: "Claude Desktop",
      }),
    );

    expect(res.status).toBe(303); // 303 See Other -> GET redirect
    expect(fake.__insertedClients).toHaveLength(1);
    expect(fake.__insertedClients[0]).toMatchObject({
      user_id: "user_a",
      client_id: "mcp-claude",
      client_name: "Claude Desktop",
      redirect_uris: ["https://claude.ai/callback"],
    });
    // Authorization code was also persisted as a sanity check that the
    // upsert ran ALONGSIDE the existing OAuth flow, not in place of it.
    expect(fake.__insertedCodes).toHaveLength(1);
  });

  it("does NOT persist a row when the user clicks Deny", async () => {
    const { code_challenge } = pkceFixture();

    mocks.getSupabaseUser.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: "user_a", is_anonymous: false } },
          error: null,
        }),
      },
    });
    const fake = buildSupabaseServerFake();
    mocks.getSupabaseServer.mockReturnValue(fake);

    const res = await consentRoute.POST(
      formRequest({
        decision: "deny",
        response_type: "code",
        redirect_uri: "https://claude.ai/callback",
        state: "state_xyz",
        code_challenge,
        code_challenge_method: "S256",
        scope: "mcp:tools",
        client_id: "mcp-claude",
        client_name: "Claude Desktop",
      }),
    );

    expect(res.status).toBe(303);
    // No oauth_clients row should be created -- only the redirect with
    // the access_denied error gets returned to the upstream client.
    expect(fake.__insertedClients).toHaveLength(0);
  });
});
