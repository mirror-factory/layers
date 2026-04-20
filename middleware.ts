/**
 * Next.js middleware — responsibilities:
 *
 * 1. Gate /dev-kit dashboard behind DEV_KIT_DASHBOARD_SECRET
 * 2. Inject x-request-id on every request (correlates with withRoute logs)
 * 3. Ensure every visitor has a Supabase session (anonymous sign-in)
 * 4. Protect pages that require real (non-anonymous) auth
 */
import { NextResponse, type NextRequest } from 'next/server';
import { devKitAuthGuard, isDevKitPath } from './lib/middleware-dev-kit';
import { createServerClient } from '@supabase/ssr';

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Pages that work fine with anonymous auth (no real sign-in required) */
const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up'];

/** Prefixes that should never be auth-gated */
const BYPASS_PREFIXES = ['/auth', '/api', '/_next', '/worklets', '/sign-in', '/sign-up'];

function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return false;
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  return true;
}

export async function middleware(req: NextRequest) {
  // 1. Gate the dev-kit dashboard
  if (isDevKitPath(req.nextUrl.pathname)) {
    const blocked = devKitAuthGuard(req);
    if (blocked) return blocked;
  }

  // 2. Inject x-request-id
  const incoming = req.headers.get('x-request-id');
  const requestId = incoming && /^[\w_-]{1,64}$/.test(incoming) ? incoming : generateRequestId();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);

  // 3. Supabase session management
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(items) {
          for (const { name, value, options } of items) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      // Sign in anonymously so the recorder works without sign-up
      await supabase.auth.signInAnonymously().catch(() => {});
    }

    // 4. Protect non-public pages from anonymous users
    if (isProtectedPath(req.nextUrl.pathname)) {
      // A user is "real" if they have an email or identity linked.
      // is_anonymous === true means they signed in anonymously.
      // is_anonymous === undefined/false means email/OAuth sign-in.
      const isAnonymous = data.user?.is_anonymous === true;
      const hasEmail = !!data.user?.email;
      if (!data.user || (isAnonymous && !hasEmail)) {
        // Redirect to sign-in for protected pages
        const signInUrl = new URL('/sign-in', req.url);
        signInUrl.searchParams.set('next', req.nextUrl.pathname);
        return NextResponse.redirect(signInUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|worklets/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|js\\.map|css\\.map)$).*)',
  ],
};
