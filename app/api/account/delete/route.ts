export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { deleteAccountData } from "@/lib/account/delete-account";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/user";
import { withRoute } from "@/lib/with-route";

export const POST = withRoute(async (req) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let body: { confirmation?: unknown };
  try {
    body = (await req.json()) as { confirmation?: unknown };
  } catch {
    body = {};
  }

  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm account deletion." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database is not configured" },
      { status: 503 },
    );
  }

  const result = await deleteAccountData(supabase, userId);

  return NextResponse.json({
    deleted: true,
    deletedUserId: result.deletedUserId,
    steps: result.steps,
  });
});
