/**
 * HTML email templates.
 * Email-safe RGB fallbacks for the Layers Paper Calm design tokens.
 */

const FONT_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const EMAIL_COLORS = {
  page: "rgb(8, 19, 20)",
  surface: "rgb(24, 30, 31)",
  surfaceRaised: "rgb(34, 42, 43)",
  text: "rgb(245, 247, 245)",
  textMuted: "rgb(163, 170, 168)",
  textFaint: "rgb(116, 124, 122)",
  mint: "rgb(20, 184, 166)",
  mintInk: "rgb(7, 34, 33)",
} as const;

function layout(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:${EMAIL_COLORS.page};font-family:${FONT_FAMILY};color:${EMAIL_COLORS.text};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_COLORS.page};padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${EMAIL_COLORS.surface};border-radius:12px;padding:32px;">
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:18px;font-weight:600;color:${EMAIL_COLORS.text};font-family:${FONT_FAMILY};">Layers</span>
            </td>
          </tr>
          <tr>
            <td>
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;text-align:center;font-size:11px;color:${EMAIL_COLORS.textFaint};">
              Layers &mdash; capture conversations, extract insights
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px auto;">
  <tr>
    <td style="background:${EMAIL_COLORS.mint};border-radius:6px;padding:12px 28px;">
      <a href="${href}" style="color:${EMAIL_COLORS.mintInk};text-decoration:none;font-weight:600;font-size:14px;font-family:${FONT_FAMILY};">${text}</a>
    </td>
  </tr>
</table>`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function magicLinkEmail(magicLink: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Sign in to Layers",
    html: layout(`
      <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.text};margin:0 0 8px;">
        Click the button below to sign in to your account.
      </p>
      ${ctaButton("Sign In", magicLink)}
      <p style="font-size:12px;line-height:1.5;color:${EMAIL_COLORS.textMuted};margin:16px 0 0;">
        If you didn't request this, you can safely ignore this email.
        This link expires in 1 hour.
      </p>
    `),
  };
}

export function otpEmail(otp: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Your Layers verification code",
    html: layout(`
      <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.text};margin:0 0 16px;">
        Enter this code to verify your account:
      </p>
      <p style="text-align:center;margin:24px 0;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${EMAIL_COLORS.mint};font-family:${FONT_FAMILY};">${otp}</span>
      </p>
      <p style="font-size:12px;line-height:1.5;color:${EMAIL_COLORS.textMuted};margin:16px 0 0;">
        This code expires in 10 minutes. If you didn't request it, ignore this email.
      </p>
    `),
  };
}

// ---------------------------------------------------------------------------
// Onboarding sequence (PROD-390)
//
// Three transactional emails. Voice: Paper Calm. Direct, restrained,
// granola-not-mailchimp. No "Hi there!", no emojis, no exclamation marks,
// no marketing pile-on. One idea per email, one CTA, one quiet sign-off.
// ---------------------------------------------------------------------------

const SIGN_OFF = `<p style="font-size:13px;line-height:1.6;color:${EMAIL_COLORS.textMuted};margin:24px 0 0;">— The Layers team</p>`;

function unsubscribeFooter(appUrl: string): string {
  return `<p style="font-size:11px;line-height:1.5;color:${EMAIL_COLORS.textFaint};margin:24px 0 0;text-align:center;">
    You're getting this because you signed up for Layers.
    <a href="${appUrl}/settings/notifications" style="color:${EMAIL_COLORS.textFaint};text-decoration:underline;">Turn off onboarding emails</a>.
  </p>`;
}

/**
 * Welcome — sent on first sign-in.
 * One sentence of welcome, one CTA to /record, no feature list.
 */
export function welcomeEmail(appUrl: string): {
  subject: string;
  html: string;
} {
  const recordUrl = `${appUrl}/record`;
  return {
    subject: "Welcome to Layers — here's what to do next",
    html: layout(`
      <p style="font-size:15px;line-height:1.6;color:${EMAIL_COLORS.text};margin:0 0 12px;">
        Welcome to Layers.
      </p>
      <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.text};margin:0 0 8px;">
        The fastest way to feel what Layers does is to record one short conversation —
        a standup, a customer call, a working session. We'll transcribe it, surface the
        decisions and action items, and remember it for next time.
      </p>
      ${ctaButton("Start a recording", recordUrl)}
      <p style="font-size:13px;line-height:1.6;color:${EMAIL_COLORS.textMuted};margin:16px 0 0;">
        Two minutes is enough.
      </p>
      ${SIGN_OFF}
      ${unsubscribeFooter(appUrl)}
    `),
  };
}

/**
 * First-meeting nudge — sent 24h after sign-in when zero meetings exist.
 * Lower-stakes ask. No guilt, no streak language.
 */
export function firstMeetingNudgeEmail(appUrl: string): {
  subject: string;
  html: string;
} {
  const recordUrl = `${appUrl}/record`;
  return {
    subject: "Try a short recording to see what Layers remembers",
    html: layout(`
      <p style="font-size:15px;line-height:1.6;color:${EMAIL_COLORS.text};margin:0 0 12px;">
        You signed up yesterday and haven't recorded anything yet.
      </p>
      <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.text};margin:0 0 8px;">
        That's fine — but the value of Layers shows up after the first meeting,
        not before. A two-minute test recording will give you the full picture:
        transcript, summary, action items, and the start of a searchable memory
        across future conversations.
      </p>
      ${ctaButton("Record two minutes", recordUrl)}
      <p style="font-size:13px;line-height:1.6;color:${EMAIL_COLORS.textMuted};margin:16px 0 0;">
        Or upload an existing audio file — same flow.
      </p>
      ${SIGN_OFF}
      ${unsubscribeFooter(appUrl)}
    `),
  };
}

/**
 * Week-1 follow-up — sent 7 days after sign-in.
 * Soft feedback ask. Plain reply, no form.
 */
export function weekOneFollowupEmail(appUrl: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "What's worked? What hasn't?",
    html: layout(`
      <p style="font-size:15px;line-height:1.6;color:${EMAIL_COLORS.text};margin:0 0 12px;">
        You've been on Layers for a week.
      </p>
      <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.text};margin:0 0 8px;">
        We read every reply. If something's slow, broken, or missing — or if
        a particular meeting flow saved you time — we want to hear it. One
        sentence is plenty.
      </p>
      <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.text};margin:16px 0 0;">
        Reply to this email, or write to
        <a href="mailto:support@mirrorfactory.ai" style="color:${EMAIL_COLORS.mint};text-decoration:underline;">support@mirrorfactory.ai</a>.
      </p>
      ${SIGN_OFF}
      ${unsubscribeFooter(appUrl)}
    `),
  };
}

export function meetingReadyEmail(
  title: string,
  meetingUrl: string,
): {
  subject: string;
  html: string;
} {
  return {
    subject: `Meeting ready: ${title}`,
    html: layout(`
      <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.text};margin:0 0 8px;">
        Your meeting has been processed and is ready to review.
      </p>
      <p style="font-size:16px;font-weight:600;color:${EMAIL_COLORS.text};margin:16px 0;">
        "${title}"
      </p>
      ${ctaButton("View Meeting", meetingUrl)}
    `),
  };
}
