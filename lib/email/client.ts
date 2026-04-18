/**
 * Resend email client — single instance for the app.
 *
 * Sends transactional emails: magic link, welcome, meeting summary digest.
 * Uses Resend's API directly (not SMTP) for better deliverability and
 * template management.
 *
 * Env: RESEND_API_KEY
 */

import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (cached) return cached;
  cached = new Resend(key);
  return cached;
}

/** Default sender — update once a custom domain is verified in Resend. */
export const FROM_EMAIL = "audio-layer <onboarding@resend.dev>";

/** App name for email subjects. */
export const APP_NAME = "audio-layer";
