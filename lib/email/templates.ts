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

export function welcomeEmail(appUrl: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Welcome to Layers",
    html: layout(`
      <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.text};margin:0 0 8px;">
        Welcome! You're all set to start capturing and analyzing conversations.
      </p>
      <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.text};margin:0 0 16px;">
        Here's what you can do:
      </p>
      <ul style="font-size:14px;line-height:1.8;color:${EMAIL_COLORS.text};padding-left:20px;margin:0 0 16px;">
        <li>Upload audio recordings for batch transcription</li>
        <li>Record live with real-time speaker diarization</li>
        <li>Get AI-powered summaries, action items, and intake forms</li>
        <li>Track costs transparently per meeting</li>
      </ul>
      ${ctaButton("Get Started", appUrl)}
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
