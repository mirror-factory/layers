/**
 * PROD-403: revoke a personal-access token.
 *
 * Flips `revoked_at` so the PAT can no longer authenticate (validator
 * path lands in a follow-up; see `app/api/account/api-keys/route.ts`).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { getCurrentUserId } from "@/lib/supabase/user";
import { getSupabaseServer } from "@/lib/supabase/server";

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
      { error: "Missing key id" },
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

  const { data: existing } = await supabase
    .from("api_keys")
    .select("id, revoked_at")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  if ((existing as { revoked_at: string | null }).revoked_at) {
    return NextResponse.json({ revoked: true, alreadyRevoked: true });
  }

  await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);

  return NextResponse.json({ revoked: true });
});
