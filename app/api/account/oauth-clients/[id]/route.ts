/**
 * PROD-403: revoke an OAuth client.
 *
 * `DELETE /api/account/oauth-clients/:id` sets `revoked_at = now()` on the
 * row. Subsequent MCP bearer validation joins the access JWT's `client_id`
 * claim to this column and returns 401 + `error: "client_revoked"` so the
 * MCP client surfaces a "you revoked this app, please reconnect" message.
 *
 * We also cascade-revoke any live `oauth_refresh_tokens` scoped to the
 * client so a token-endpoint redeem fails immediately instead of waiting
 * for the access token's `exp` (up to ~60 minutes).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { getCurrentUserId } from "@/lib/supabase/user";
import { getSupabaseServer } from "@/lib/supabase/server";
import { revokeOauthClient } from "@/lib/oauth/clients";

export const DELETE = withRoute(async (_req, ctx) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string" || id.length === 0) {
    return NextResponse.json(
      { error: "Missing client id" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const result = await revokeOauthClient(supabase, { userId, id });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json(
        { error: "Connected app not found" },
        { status: 404 },
      );
    }
    if (result.reason === "already_revoked") {
      // Idempotent: revoking a revoked client is not an error -- the
      // user clicked Revoke twice. Surface a 200 so the UI doesn't show
      // a scary red toast for a benign state.
      return NextResponse.json({ revoked: true, alreadyRevoked: true });
    }
  }

  return NextResponse.json({ revoked: true });
});
