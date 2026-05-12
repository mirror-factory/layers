/**
 * OAuth client lifecycle helpers (PROD-403).
 *
 * Persists Dynamic Client Registration clients on FIRST successful
 * authorization (i.e. when the user consents), not on register POST.
 *
 * `client_id` is the stateless identifier we mint in
 * `/api/oauth/register` -- something like `mcp-<uuid>`. We upsert
 * keyed on (user_id, client_id) so the same MCP client connecting
 * twice does not produce duplicate rows.
 *
 * Revocation flips `revoked_at`. Token validation
 * (`lib/mcp/auth.ts:validateMcpBearerToken`) joins on this column and
 * rejects revoked clients with `error: "client_revoked"`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface OAuthClientRow {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface OAuthClientSummary {
  id: string;
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function toSummary(row: OAuthClientRow): OAuthClientSummary {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    redirectUris: row.redirect_uris ?? [],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

/**
 * Persist (or refresh) an OAuth client on first successful authorization.
 * If the row already exists, bump `last_used_at` so the user sees a recent
 * connection in the UI. If the row was previously revoked, leave
 * `revoked_at` untouched -- the user must approve consent again, and that
 * SHOULD undo the revocation by passing `unrevoke: true` so the column
 * is cleared. We intentionally clear here because reaching consent means
 * the user has just re-approved the same client.
 */
export async function upsertOauthClient(
  supabase: SupabaseClient,
  params: {
    userId: string;
    clientId: string;
    clientName?: string | null;
    redirectUris: string[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("oauth_clients").upsert(
    {
      user_id: params.userId,
      client_id: params.clientId,
      client_name: params.clientName ?? null,
      redirect_uris: params.redirectUris,
      last_used_at: now,
      revoked_at: null,
    },
    { onConflict: "user_id,client_id" },
  );
}

/**
 * Look up an OAuth client by user_id + client_id. Returns null if no row,
 * which means we never persisted the client (e.g. a freshly-registered
 * client that never made it past the register POST).
 */
export async function getOauthClient(
  supabase: SupabaseClient,
  params: { userId: string; clientId: string },
): Promise<OAuthClientRow | null> {
  const { data, error } = await supabase
    .from("oauth_clients")
    .select(
      "id, user_id, client_id, client_name, redirect_uris, created_at, last_used_at, revoked_at",
    )
    .eq("user_id", params.userId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (error || !data) return null;
  return data as OAuthClientRow;
}

/**
 * Lookup by client_id alone, used by token validation where we don't yet
 * have the user_id from the bearer (we trust the JWT's sub claim).
 */
export async function getOauthClientByClientId(
  supabase: SupabaseClient,
  clientId: string,
): Promise<OAuthClientRow | null> {
  const { data, error } = await supabase
    .from("oauth_clients")
    .select(
      "id, user_id, client_id, client_name, redirect_uris, created_at, last_used_at, revoked_at",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (error || !data) return null;
  return data as OAuthClientRow;
}

export async function listOauthClientsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<OAuthClientSummary[]> {
  const { data, error } = await supabase
    .from("oauth_clients")
    .select(
      "id, user_id, client_id, client_name, redirect_uris, created_at, last_used_at, revoked_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as OAuthClientRow[]).map(toSummary);
}

export async function revokeOauthClient(
  supabase: SupabaseClient,
  params: { userId: string; id: string },
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "already_revoked" }> {
  const { data: existing } = await supabase
    .from("oauth_clients")
    .select("id, revoked_at")
    .eq("user_id", params.userId)
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) return { ok: false, reason: "not_found" };
  if ((existing as { revoked_at: string | null }).revoked_at) {
    return { ok: false, reason: "already_revoked" };
  }

  const now = new Date().toISOString();
  await supabase
    .from("oauth_clients")
    .update({ revoked_at: now })
    .eq("user_id", params.userId)
    .eq("id", params.id);

  // Cascade: also revoke any live refresh tokens scoped to this client_id
  // so the next token-endpoint hit fails instead of waiting for the access
  // token to naturally expire.
  const { data: client } = await supabase
    .from("oauth_clients")
    .select("client_id")
    .eq("id", params.id)
    .maybeSingle();
  const clientId = (client as { client_id: string } | null)?.client_id;
  if (clientId) {
    await supabase
      .from("oauth_refresh_tokens")
      .update({ revoked_at: now })
      .eq("client_id", clientId)
      .is("revoked_at", null);
  }

  return { ok: true };
}

/**
 * Bump `last_used_at` for analytics + the "Last used" column in the UI.
 * Best-effort: if the row doesn't exist yet (older refresh tokens issued
 * before PROD-403 shipped), this is a no-op rather than an error.
 */
export async function touchOauthClient(
  supabase: SupabaseClient,
  params: { userId: string; clientId: string },
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("oauth_clients")
    .update({ last_used_at: now })
    .eq("user_id", params.userId)
    .eq("client_id", params.clientId);
}
