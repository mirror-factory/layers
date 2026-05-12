export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { sendWelcomeEmailOnce } from "@/lib/email/onboarding";
import { log } from "@/lib/logger";

/**
 * Web OAuth + magic-link callback.
 *
 * Native (Capacitor) Google OAuth does NOT come through this route. On
 * iOS/Android the Supabase `redirectTo` is the custom URL scheme
 * `com.mirrorfactory.layers://auth/callback`, which Safari hands back to
 * the app via `App.addListener('appUrlOpen', ...)`. The PKCE code is
 * exchanged inside the WebView by `lib/auth/native-oauth.ts`, so this
 * server route only sees web traffic. See PROD-408.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "magiclink";
  const next = searchParams.get("next") ?? "/";

  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // If no code AND no token_hash, the token is in the URL hash fragment
  // which can't be read server-side. Redirect to a client page that handles it.
  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/auth/confirm`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>,
      ) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  if (code) {
    // PKCE flow
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/sign-in?error=auth_exchange_failed`);
    }
  } else if (tokenHash) {
    // OTP / magic link with token_hash
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email",
    });
    if (error) {
      return NextResponse.redirect(`${origin}/sign-in?error=verify_failed`);
    }
  }

  // Fire welcome email on first sign-in. Idempotent — guarded by
  // `profiles.welcome_email_sent_at` (PROD-390). Best-effort: never block
  // the redirect on a Resend / Supabase hiccup.
  try {
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult?.user;
    if (user?.id && user.email) {
      // Fire-and-forget — Next.js will hold the route open until the
      // promise resolves (no `waitUntil` available in this runtime) but
      // any failure is swallowed so the redirect always wins.
      await sendWelcomeEmailOnce({
        userId: user.id,
        email: user.email,
      }).catch((err) => {
        log.warn("auth.callback.welcome-email-failed", {
          userId: user.id,
          err: { message: err instanceof Error ? err.message : String(err) },
        });
      });
    }
  } catch (err) {
    log.warn("auth.callback.welcome-email-error", {
      err: { message: err instanceof Error ? err.message : String(err) },
    });
  }

  return response;
}
