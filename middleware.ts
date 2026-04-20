/**
 * Next.js middleware — Supabase SSR best practices pattern.
 *
 * Critical: the setAll callback MUST update both the request cookies
 * AND recreate the response. Without this, the browser and server
 * go out of sync and the user's session gets dropped.
 *
 * See: https://supabase.com/docs/guides/getting-started/ai-prompts/nextjs-supabase-auth
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { devKitAuthGuard, isDevKitPath } from "./lib/middleware-dev-kit";

export async function middleware(request: NextRequest) {
  // Dev-kit dashboard gate
  if (isDevKitPath(request.nextUrl.pathname)) {
    const blocked = devKitAuthGuard(request);
    if (blocked) return blocked;
  }

  // Supabase session proxy — this is the official pattern
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // 1. Update the request cookies (so server components see them)
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );

        // 2. Recreate the response with updated request
        supabaseResponse = NextResponse.next({ request });

        // 3. Set cookies on the response (so browser stores them)
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do not add code between createServerClient and getUser().
  // A simple mistake here can cause random session drops.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user at all, sign in anonymously (for API routes that need user_id)
  if (!user) {
    await supabase.auth.signInAnonymously().catch(() => {});
  }

  // Inject x-request-id for observability
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  supabaseResponse.headers.set("x-request-id", requestId);

  // IMPORTANT: return the supabaseResponse as-is. Do not create a new
  // NextResponse — the cookies on supabaseResponse keep browser and
  // server in sync. Modifying or replacing it breaks auth.
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|worklets/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
