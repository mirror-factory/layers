/**
 * Onboarding email sequence — server-side helpers (PROD-390).
 *
 * Three transactional emails, all routed through Resend with the standard
 * `withExternalCall` telemetry wrapper:
 *
 *   1. Welcome              fires on first sign-in
 *   2. First-meeting nudge  fires 24h after sign-in if no meeting yet
 *   3. Week-1 follow-up     fires 7 days after sign-in
 *
 * Idempotency is enforced at the database layer via `profiles.*_sent_at`
 * columns (see migration 00010). Each helper is a no-op when the column is
 * already populated, so the daily cron can run safely without dedupe logic
 * of its own.
 *
 * Opt-out is honored via `profiles.onboarding_emails_enabled`.
 * The transactional welcome still fires on first sign-in even when the
 * column is null/true — that's the implicit consent boundary. Subsequent
 * follow-ups respect the flag.
 *
 * Resend / Supabase missing: every helper silently returns `{ skipped: true,
 * reason: "..." }` so the cron route never 500s on a partially-configured
 * preview env. Status is logged via the logger; the cron route exposes the
 * aggregate counts so failures are still observable.
 */

import { log } from "@/lib/logger";
import { getResend, FROM_EMAIL } from "@/lib/email/client";
import { getSupabaseServer } from "@/lib/supabase/server";
import { withExternalCall } from "@/lib/with-external";
import {
  welcomeEmail,
  firstMeetingNudgeEmail,
  weekOneFollowupEmail,
} from "@/lib/email/templates";

export type OnboardingEmailKind =
  | "welcome"
  | "first_meeting_nudge"
  | "week_one_followup";

export interface OnboardingEmailResult {
  sent: boolean;
  skipped?: true;
  reason?: string;
  kind: OnboardingEmailKind;
}

interface SendArgs {
  userId: string;
  email: string;
  appUrl: string;
  requestId?: string;
}

const SENT_COLUMN: Record<OnboardingEmailKind, string> = {
  welcome: "welcome_email_sent_at",
  first_meeting_nudge: "first_meeting_nudge_sent_at",
  week_one_followup: "week_one_email_sent_at",
};

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://layers.mirrorfactory.ai"
  );
}

/**
 * Render and send a single onboarding email. Returns `{ sent: false,
 * skipped: true }` for any guard miss (already sent, opted out, Resend
 * unavailable). Never throws — callers should treat this as a fire-and-log.
 */
async function sendOnboardingEmail(
  kind: OnboardingEmailKind,
  args: SendArgs,
): Promise<OnboardingEmailResult> {
  const { email, appUrl } = args;

  const resend = getResend();
  if (!resend) {
    log.warn("onboarding-email.skipped", { kind, reason: "resend-unconfigured" });
    return { sent: false, skipped: true, reason: "resend-unconfigured", kind };
  }

  const template =
    kind === "welcome"
      ? welcomeEmail(appUrl)
      : kind === "first_meeting_nudge"
        ? firstMeetingNudgeEmail(appUrl)
        : weekOneFollowupEmail(appUrl);

  try {
    await withExternalCall(
      {
        vendor: "resend",
        operation: `emails.send.onboarding.${kind}`,
        requestId: args.requestId,
        userId: args.userId,
      },
      () =>
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: template.subject,
          html: template.html,
        }),
      {
        inputSummary: { kind, recipient: email },
      },
    );
  } catch (err) {
    log.error("onboarding-email.failed", {
      kind,
      userId: args.userId,
      err: { message: err instanceof Error ? err.message : String(err) },
    });
    return { sent: false, skipped: true, reason: "send-failed", kind };
  }

  // Mark sent. Best-effort: if Supabase is down we still consider the email
  // delivered. Worst case a user gets one duplicate the next cron run.
  const supabase = getSupabaseServer();
  if (supabase) {
    const patch: Record<string, string> = {
      [SENT_COLUMN[kind]]: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("user_id", args.userId);
    if (error) {
      log.warn("onboarding-email.mark-sent-failed", {
        kind,
        userId: args.userId,
        message: error.message,
      });
    }
  }

  return { sent: true, kind };
}

/**
 * Send the welcome email on first sign-in.
 *
 * Idempotent — checks `welcome_email_sent_at` first; bumps `signed_up_at`
 * if missing so the cron can compute the 24h / 7d windows.
 */
export async function sendWelcomeEmailOnce(args: {
  userId: string;
  email: string;
  requestId?: string;
}): Promise<OnboardingEmailResult> {
  const appUrl = getAppUrl();
  const supabase = getSupabaseServer();
  if (!supabase) {
    log.warn("onboarding-email.welcome.skipped", { reason: "supabase-unconfigured" });
    return {
      sent: false,
      skipped: true,
      reason: "supabase-unconfigured",
      kind: "welcome",
    };
  }

  // Fetch (or create) the profile row.
  const { data: existing } = await supabase
    .from("profiles")
    .select(
      "user_id, welcome_email_sent_at, signed_up_at, onboarding_emails_enabled",
    )
    .eq("user_id", args.userId)
    .maybeSingle();

  if (existing?.welcome_email_sent_at) {
    return {
      sent: false,
      skipped: true,
      reason: "already-sent",
      kind: "welcome",
    };
  }

  if (!existing) {
    await supabase
      .from("profiles")
      .insert({ user_id: args.userId, signed_up_at: new Date().toISOString() });
  } else if (!existing.signed_up_at) {
    await supabase
      .from("profiles")
      .update({ signed_up_at: new Date().toISOString() })
      .eq("user_id", args.userId);
  }

  return sendOnboardingEmail("welcome", {
    userId: args.userId,
    email: args.email,
    appUrl,
    requestId: args.requestId,
  });
}

interface DueRow {
  user_id: string;
  email: string;
  signed_up_at: string;
}

/**
 * Find users who should receive the first-meeting nudge.
 * Criteria: signed up between 24h–72h ago, no first-meeting email yet, no
 * meetings recorded, onboarding emails enabled.
 *
 * Implementation note: we don't push the "has any meeting" check into SQL
 * because the meetings table is owned by a different surface and we want
 * the cron route to fail soft when that table is missing. Instead we fetch
 * candidates then filter in JS with a count(*) query per user.
 */
export async function findFirstMeetingNudgeDue(
  windowHours = 24,
): Promise<DueRow[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const since = new Date(
    Date.now() - 72 * 60 * 60 * 1000,
  ).toISOString();
  const until = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, signed_up_at")
    .is("first_meeting_nudge_sent_at", null)
    .eq("onboarding_emails_enabled", true)
    .gte("signed_up_at", since)
    .lte("signed_up_at", until);

  if (error || !profiles?.length) return [];

  // For each candidate, check meetings count and resolve email via auth.
  const due: DueRow[] = [];
  for (const row of profiles) {
    const { count: meetingCount, error: countErr } = await supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", row.user_id);

    if (countErr) {
      log.warn("onboarding-email.first-meeting.count-failed", {
        userId: row.user_id,
        message: countErr.message,
      });
      continue;
    }
    if ((meetingCount ?? 0) > 0) continue;

    const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);
    const email = authUser?.user?.email;
    if (!email) continue;

    due.push({ user_id: row.user_id, email, signed_up_at: row.signed_up_at });
  }

  return due;
}

/**
 * Find users due for the week-1 follow-up: signed up between 7d–14d ago,
 * not yet sent, onboarding enabled.
 */
export async function findWeekOneFollowupDue(): Promise<DueRow[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const since = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const until = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, signed_up_at")
    .is("week_one_email_sent_at", null)
    .eq("onboarding_emails_enabled", true)
    .gte("signed_up_at", since)
    .lte("signed_up_at", until);

  if (error || !profiles?.length) return [];

  const due: DueRow[] = [];
  for (const row of profiles) {
    const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);
    const email = authUser?.user?.email;
    if (!email) continue;
    due.push({ user_id: row.user_id, email, signed_up_at: row.signed_up_at });
  }

  return due;
}

/**
 * Run the daily onboarding-email pass. Idempotent — safe to call multiple
 * times per day. Returns aggregate counts for the cron route response.
 */
export async function runOnboardingEmailCron(opts?: {
  requestId?: string;
}): Promise<{
  firstMeetingNudgeSent: number;
  firstMeetingNudgeSkipped: number;
  weekOneFollowupSent: number;
  weekOneFollowupSkipped: number;
}> {
  const appUrl = getAppUrl();
  let firstMeetingNudgeSent = 0;
  let firstMeetingNudgeSkipped = 0;
  let weekOneFollowupSent = 0;
  let weekOneFollowupSkipped = 0;

  const firstMeetingDue = await findFirstMeetingNudgeDue();
  for (const row of firstMeetingDue) {
    const result = await sendOnboardingEmail("first_meeting_nudge", {
      userId: row.user_id,
      email: row.email,
      appUrl,
      requestId: opts?.requestId,
    });
    if (result.sent) firstMeetingNudgeSent++;
    else firstMeetingNudgeSkipped++;
  }

  const weekOneDue = await findWeekOneFollowupDue();
  for (const row of weekOneDue) {
    const result = await sendOnboardingEmail("week_one_followup", {
      userId: row.user_id,
      email: row.email,
      appUrl,
      requestId: opts?.requestId,
    });
    if (result.sent) weekOneFollowupSent++;
    else weekOneFollowupSkipped++;
  }

  log.info("onboarding-email.cron.summary", {
    firstMeetingNudgeSent,
    firstMeetingNudgeSkipped,
    weekOneFollowupSent,
    weekOneFollowupSkipped,
  });

  return {
    firstMeetingNudgeSent,
    firstMeetingNudgeSkipped,
    weekOneFollowupSent,
    weekOneFollowupSkipped,
  };
}
