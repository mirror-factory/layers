/**
 * MCP bearer authentication.
 * OAuth access tokens are the primary path for remote MCP clients; legacy
 * profile tokens are accepted only for older manual configurations.
 *
 * PROD-403: validation now also checks `oauth_clients.revoked_at` for OAuth
 * tokens whose `client_id` claim resolves to a known client. Revoked clients
 * surface as `{ kind: "revoked" }` so the route can return a distinguishable
 * `error: "client_revoked"` instead of the generic `invalid_token`.
 */

import { getSupabaseServer } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import { jwtVerify } from "jose";
import {
  getMcpJwtSecret,
  MCP_OAUTH_AUDIENCE,
  MCP_OAUTH_ISSUER,
  MCP_OAUTH_SCOPE,
} from "@/lib/oauth/mcp-oauth";
import { getOauthClientByClientId, touchOauthClient } from "@/lib/oauth/clients";

export interface McpAuthResult {
  userId: string;
  clientId?: string | null;
}

export type McpAuthOutcome =
  | { kind: "ok"; userId: string; clientId: string | null }
  | { kind: "invalid" }
  | { kind: "revoked" };

/**
 * Validate a legacy profile token from the Authorization header.
 * Returns the user_id if valid, null otherwise.
 */
export async function validateApiKey(
  key: string,
): Promise<McpAuthResult | null> {
  if (!key || key.length < 16) return null;

  const supabase = getSupabaseServer();
  if (!supabase) {
    log.warn("mcp-auth.skip", { reason: "supabase not configured" });
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("api_key", key)
    .single();

  if (error || !data) {
    return null;
  }

  return { userId: data.user_id as string, clientId: null };
}

async function validateOAuthAccessToken(
  token: string,
): Promise<{ userId: string; clientId: string | null } | null> {
  try {
    const { payload } = await jwtVerify(token, getMcpJwtSecret(), {
      audience: MCP_OAUTH_AUDIENCE,
      issuer: MCP_OAUTH_ISSUER,
    });
    const scope = typeof payload.scope === "string" ? payload.scope : "";
    if (!scope.split(/\s+/).includes(MCP_OAUTH_SCOPE)) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    const clientId =
      typeof payload.client_id === "string" && payload.client_id
        ? payload.client_id
        : null;
    return { userId: payload.sub, clientId };
  } catch {
    return null;
  }
}

/**
 * Validate an MCP Bearer token.
 *
 * Supports both OAuth access tokens issued by `/api/oauth/token` and legacy
 * profile tokens (`lo1_...`). This keeps old manual MCP client config working
 * while matching the OAuth discovery metadata used by modern MCP clients.
 *
 * Returns `null` for any invalid / unknown token, mirroring the original
 * contract used by callers that don't care about the revocation distinction.
 * Prefer `validateMcpBearerOutcome` for new code that needs to distinguish
 * "revoked" from "invalid" (PROD-403).
 */
export async function validateMcpBearerToken(
  token: string,
): Promise<McpAuthResult | null> {
  const outcome = await validateMcpBearerOutcome(token);
  if (outcome.kind !== "ok") return null;
  return { userId: outcome.userId, clientId: outcome.clientId };
}

/**
 * Same validation as `validateMcpBearerToken` but returns a discriminated
 * outcome so callers can produce a distinct `client_revoked` response.
 */
export async function validateMcpBearerOutcome(
  token: string,
): Promise<McpAuthOutcome> {
  if (!token || token.length < 16) return { kind: "invalid" };

  if (token.startsWith("lo1_")) {
    const result = await validateApiKey(token);
    return result
      ? { kind: "ok", userId: result.userId, clientId: null }
      : { kind: "invalid" };
  }

  if (token.split(".").length === 3) {
    const oauth = await validateOAuthAccessToken(token);
    if (!oauth) return { kind: "invalid" };

    // PROD-403: cross-check the oauth_clients table. A user-revoked client
    // must fail validation IMMEDIATELY even though the access JWT itself
    // still has time left on `exp`.
    if (oauth.clientId) {
      const supabase = getSupabaseServer();
      if (supabase) {
        const client = await getOauthClientByClientId(supabase, oauth.clientId);
        if (client?.revoked_at) {
          return { kind: "revoked" };
        }
        // Best-effort: bump last_used_at so the UI's "Last used" column
        // reflects active connections without waiting for a refresh.
        // Swallow errors -- if the row doesn't exist yet (legacy tokens),
        // the touch is a harmless no-op.
        if (client) {
          await touchOauthClient(supabase, {
            userId: oauth.userId,
            clientId: oauth.clientId,
          }).catch(() => undefined);
        }
      }
    }

    return { kind: "ok", userId: oauth.userId, clientId: oauth.clientId };
  }

  return { kind: "invalid" };
}
