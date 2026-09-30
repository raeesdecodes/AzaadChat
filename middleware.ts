/**
 * Dashboard password gate.
 *
 * Two ways in (both accepted):
 *   1. v1 gate — `cz_session` cookie derived from DASHBOARD_PASSWORD.
 *   2. v2 gate — Auth.js (next-auth) JWT cookie from an email/password account
 *      (`AUTH_SECRET` must be set for the cookie to be accepted).
 *
 * Public/open routes:
 *   - /api/webhook        Meta webhook (Meta cannot log in)
 *   - /api/data-deletion  Meta data-deletion callback
 *   - /api/auth/**        Auth.js endpoints (sign-in/callback)
 *   - /privacy, /terms    public legal pages (Meta App Review requires them)
 *   - /login, /signup     the auth forms themselves
 *   - _next/**, images    static assets
 *
 * When DASHBOARD_PASSWORD is unset the app still accepts Auth.js sessions
 * and otherwise behaves as before (dev mode).
 */
import { NextRequest, NextResponse } from 'next/server';
import { decode } from 'next-auth/jwt';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/signup', '/privacy', '/terms'];
const PUBLIC_PREFIXES = ['/api/webhook', '/api/data-deletion', '/api/auth', '/_next'];

// Session cookie names across next-auth v4 (`next-auth.*`) and Auth.js v5
// (`authjs.*`), plus the `__Secure-` prefix used on HTTPS hosts.
const AUTH_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

/** True when the request carries a valid Auth.js (next-auth) JWT session. */
async function hasAuthJsSession(req: NextRequest): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  let token: string | undefined;
  let salt: string | undefined;
  for (const name of AUTH_COOKIES) {
    const value = req.cookies.get(name)?.value;
    if (value) {
      token = value;
      // @auth/core derives the JWE key from secret + salt, and for session
      // cookies the salt is the cookie name itself (see @auth/core
      // lib/actions/callback + getToken defaults).
      salt = name;
      break;
    }
  }
  if (!token || !salt) return false;
  try {
    return (await decode({ token, secret, salt })) !== null;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const password = process.env.DASHBOARD_PASSWORD;
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  // v1 gate: password-cookie session (skipped entirely when no password set).
  if (password) {
    const cookie = req.cookies.get(SESSION_COOKIE)?.value;
    if (await isValidSession(cookie, password)) return NextResponse.next();
  }

  // v2 gate: Auth.js email/password session.
  if (await hasAuthJsSession(req)) return NextResponse.next();

  // No DASHBOARD_PASSWORD configured -> open dashboard (v1 dev semantics).
  if (!password) return NextResponse.next();

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
