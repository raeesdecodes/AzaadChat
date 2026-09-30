/**
 * Minimal dashboard session helper.
 *
 * The dashboard is protected by a single shared password
 * (`DASHBOARD_PASSWORD` env var). Instead of storing the password in a
 * cookie, we store an HMAC derived from it — a stolen cookie cannot be
 * reversed back to the password, and knowing the password is the only way
 * to mint a valid cookie.
 *
 * Edge-safe: uses Web Crypto (`crypto.subtle`) so it runs in Next middleware
 * as well as in Node server actions.
 */

export const SESSION_COOKIE = 'cz_session';
const SESSION_MESSAGE = 'chatazad-dashboard-session-v1';

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** Derive the session token for a password. */
export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(SESSION_MESSAGE));
  return toHex(sig);
}

/** Constant-time-ish comparison of two strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True when the cookie holds a valid session token for `password`.
 * Always false when no password is configured (handled by the caller).
 */
export async function isValidSession(
  cookieValue: string | undefined,
  password: string,
): Promise<boolean> {
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await sessionToken(password));
}
