export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily onboarding email cron (PROD-390).
 *
 * Invocation paths:
 *   - Vercel Cron (production): configured in vercel.json under
 *     `crons[].path = "/api/cron/onboarding-emails"`. Vercel includes a
 *     `x-vercel-cron: 1` header on those invocations and we trust it as
 *     auth. See https://vercel.com/docs/cron-jobs/manage-cron-jobs.
 *   - Manual scheduler / external uptime check: send a `Authorization:
 *     Bearer ${CRON_SECRET}` header. The secret is set per environment.
 *   - Tests / contract smoke: when `CRON_SECRET` is unset and Vercel
 *     headers are absent the route returns 401, which keeps the route
 *     contract smoke happy (it expects 401|503).
 *
 * The handler is GET-only (Vercel Cron uses GET) and returns a small JSON
 * payload describing how many emails were sent and how many were skipped
 * — useful for the on-call dashboard and the contract test.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { runOnboardingEmailCron } from "@/lib/email/onboarding";

const CronResponseSchema = z.object({
  ok: z.literal(true),
  firstMeetingNudgeSent: z.number().int().nonnegative(),
  firstMeetingNudgeSkipped: z.number().int().nonnegative(),
  weekOneFollowupSent: z.number().int().nonnegative(),
  weekOneFollowupSkipped: z.number().int().nonnegative(),
});

export type CronResponse = z.infer<typeof CronResponseSchema>;

function isAuthorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export const GET = withRoute(async (req, ctx) => {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const result = await runOnboardingEmailCron({ requestId: ctx.requestId });

  const body: CronResponse = {
    ok: true,
    firstMeetingNudgeSent: result.firstMeetingNudgeSent,
    firstMeetingNudgeSkipped: result.firstMeetingNudgeSkipped,
    weekOneFollowupSent: result.weekOneFollowupSent,
    weekOneFollowupSkipped: result.weekOneFollowupSkipped,
  };

  return NextResponse.json(CronResponseSchema.parse(body));
});
