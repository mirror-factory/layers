/**
 * Next.js middleware -- injects x-request-id on every request, and gates
 * the /dev-kit dashboard + /api/dev-kit routes behind `devKitAuthGuard`.
 *
 * Runs before routes and layouts so API handlers and server components both
 * see the same id. Works with the `withRoute()` wrapper: if a client sends
 * an `x-request-id`, it's respected; otherwise we generate one.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { devKitAuthGuard, isDevKitPath } from './lib/middleware-dev-kit';

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function middleware(req: NextRequest) {
  // Gate the dashboard first. If the guard rejects, we never need to touch
  // request-id injection for the rejected response.
  if (isDevKitPath(req.nextUrl.pathname)) {
    const blocked = devKitAuthGuard(req);
    if (blocked) return blocked;
  }

  const incoming = req.headers.get('x-request-id');
  const requestId = incoming && /^[\w_-]{1,64}$/.test(incoming) ? incoming : generateRequestId();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  // Run on everything except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
