/**
 * MCP bearer authentication.
 * OAuth access tokens are the primary path for remote MCP clients; legacy
 * profile tokens are accepted only for older manual configurations.
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

export interface McpAuthResult {
  userId: string;
}

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

  return { userId: data.user_id as string };
}

async function validateOAuthAccessToken(
  token: string,
): Promise<McpAuthResult | null> {
  try {
    const { payload } = await jwtVerify(token, getMcpJwtSecret(), {
      audience: MCP_OAUTH_AUDIENCE,
      issuer: MCP_OAUTH_ISSUER,
    });
    const scope = typeof payload.scope === "string" ? payload.scope : "";
    if (!scope.split(/\s+/).includes(MCP_OAUTH_SCOPE)) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return { userId: payload.sub };
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
 */
export async function validateMcpBearerToken(
  token: string,
): Promise<McpAuthResult | null> {
  if (!token || token.length < 16) return null;

  if (token.startsWith("lo1_")) {
    return validateApiKey(token);
  }

  if (token.split(".").length === 3) {
    const oauth = await validateOAuthAccessToken(token);
    if (oauth) return oauth;
  }

  return null;
}
