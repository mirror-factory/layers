/**
 * PROD-403: list connected OAuth clients for the signed-in user.
 *
 * Returns the persisted `oauth_clients` rows (those that reached at least
 * one successful consent) keyed by user_id, newest first. Includes
 * last_used_at and revoked_at so the UI can render a "Last used" column
 * and a strikethrough/badge on revoked rows.
 *
 * Empty array is a legitimate response -- it means the user has not yet
 * connected any MCP client. The UI surfaces that as the "No connected
 * apps yet" empty state.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { getCurrentUserId } from "@/lib/supabase/user";
import { getSupabaseServer } from "@/lib/supabase/server";
import { listOauthClientsForUser } from "@/lib/oauth/clients";

export const GET = withRoute(async () => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const clients = await listOauthClientsForUser(supabase, userId);
  return NextResponse.json({ clients });
});
