/**
 * Dashboard password gate.
 *
 * When `DASHBOARD_PASSWORD` is set, every route except the public ones below
 * requires a valid session cookie. Public/open routes:
 *   - /api/webhook        Meta webhook (Meta cannot log in)
 *   - /api/data-deletion  Meta data-deletion callback
 *   - /privacy, /terms    public legal pages (Meta App Review requires them)
 *   - /login              the password form itself
 *   - _next/**, images    static assets
 *
 * When the env var is unset the app behaves exactly as before (dev mode).
 */
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/privacy', '/terms'];
const PUBLIC_PREFIXES = ['/api/webhook', '/api/data-deletion', '/_next'];

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const password = process.env.DASHBOARD_PASSWORD;
  const { pathname } = req.nextUrl;

  // No password configured -> open dashboard (development / v2-auth later).
  if (!password) return NextResponse.next();

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSession(cookie, password)) return NextResponse.next();

  // API/server-action calls get a plain 401, browsers get sent to /login.
  if (pathname.startsWith('/api/')) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Cookie' },
    });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('next', pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except static files and the Meta-facing endpoints.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};
