/**
 * Free-tier quota check.
 *
 * Per the product brief: 25 lifetime meetings on the free tier;
 * paid tiers bypass. We count meetings via the user-scoped Supabase
 * client (RLS already enforces per-user isolation), so this works
 * with the existing anon-or-email session model.
 *
 * Returns a structured result so callers can surface the right
 * error code and CTA to the user.
 */

import { getSupabaseUser, getCurrentUserId } from "@/lib/supabase/user";

export const FREE_TIER_MEETING_LIMIT = 25;

export type QuotaCheck =
  | { allowed: true; reason: "subscription" | "under_free_limit" | "no_supabase"; meetingsUsed: number; limit: number }
  | { allowed: false; reason: "free_limit_reached"; meetingsUsed: number; limit: number };

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export async function checkQuota(): Promise<QuotaCheck> {
  const supabase = await getSupabaseUser();
  if (!supabase) {
    // Dev mode without Supabase — quota doesn't apply.
    return {
      allowed: true,
      reason: "no_supabase",
      meetingsUsed: 0,
      limit: FREE_TIER_MEETING_LIMIT,
    };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      allowed: true,
      reason: "no_supabase",
      meetingsUsed: 0,
      limit: FREE_TIER_MEETING_LIMIT,
    };
  }

  // Active subscription bypasses the free cap.
  const profile = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("user_id", userId)
    .maybeSingle<{ subscription_status: string | null }>();
  const status = profile.data?.subscription_status;
  if (status && ACTIVE_STATUSES.has(status)) {
    return {
      allowed: true,
      reason: "subscription",
      meetingsUsed: 0,
      limit: Infinity,
    };
  }

  // Lifetime count for the free tier. RLS scopes the count to this
  // user; service-role isn't required.
  const { count, error } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true });
  if (error) {
    // Fail open: don't lock users out on a transient DB error. The
    // counter just won't tick for this request.
    console.error("Quota count failed", error);
    return {
      allowed: true,
      reason: "under_free_limit",
      meetingsUsed: 0,
      limit: FREE_TIER_MEETING_LIMIT,
    };
  }

  const used = count ?? 0;
  if (used >= FREE_TIER_MEETING_LIMIT) {
    return {
      allowed: false,
      reason: "free_limit_reached",
      meetingsUsed: used,
      limit: FREE_TIER_MEETING_LIMIT,
    };
  }
  return {
    allowed: true,
    reason: "under_free_limit",
    meetingsUsed: used,
    limit: FREE_TIER_MEETING_LIMIT,
  };
}
