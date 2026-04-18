/**
 * POST /api/auth/send-email
 *
 * Supabase "Send Email" auth hook. When configured in the Supabase
 * dashboard (Authentication → Hooks → Send Email), Supabase calls
 * this endpoint instead of using its built-in SMTP to send auth
 * emails (magic links, OTP codes, etc.).
 *
 * This lets us use Resend for better deliverability and branded
 * email templates.
 *
 * Setup:
 *   1. Deploy this route
 *   2. Supabase dashboard → Authentication → Hooks → Send Email
 *   3. Set URL: https://layer-1-audio.vercel.app/api/auth/send-email
 *   4. Set secret (SUPABASE_AUTH_HOOK_SECRET) for request verification
 */

import { NextResponse } from "next/server";
import { getResend, FROM_EMAIL } from "@/lib/email/client";
import { magicLinkEmail, otpEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SendEmailPayload {
  /** The type of email to send */
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | "signup"
      | "login"
      | "magiclink"
      | "recovery"
      | "invite"
      | "email_change"
      | "email";
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
  user: {
    id: string;
    email: string;
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  const resend = getResend();
  if (!resend) {
    console.error("RESEND_API_KEY not set — cannot send auth email");
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 },
    );
  }

  let payload: SendEmailPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email_data, user } = payload;
  const email = user.email;
  const type = email_data.email_action_type;

  // Build the confirmation URL
  const confirmUrl = `${email_data.site_url}/auth/callback?token_hash=${email_data.token_hash}&type=${type}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

  let subject: string;
  let html: string;

  switch (type) {
    case "magiclink":
    case "login": {
      const tmpl = magicLinkEmail({ confirmUrl, email });
      subject = tmpl.subject;
      html = tmpl.html;
      break;
    }
    case "signup":
    case "email": {
      // For signup, send OTP code
      const tmpl = otpEmail({ token: email_data.token, email });
      subject = tmpl.subject;
      html = tmpl.html;
      break;
    }
    case "recovery": {
      const tmpl = magicLinkEmail({ confirmUrl, email });
      subject = `Reset your password`;
      html = tmpl.html;
      break;
    }
    default: {
      const tmpl = magicLinkEmail({ confirmUrl, email });
      subject = tmpl.subject;
      html = tmpl.html;
    }
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Resend send failed:", err);
    return NextResponse.json(
      { error: `Email send failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
