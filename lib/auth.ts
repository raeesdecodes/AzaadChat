/**
 * Minimal dashboard session helper.
 *
 * The dashboard is protected by one or more passwords held in the
 * `DASHBOARD_PASSWORD` env var. Several passwords are supported by listing
 * them comma-separated, e.g.
 *
 *   DASHBOARD_PASSWORD=XzQWBZbdn4WtZpp1sjHXQr3, BlueTigerRunsFast2026
 *
 * so a long random string AND a memorable English one both work. (A plain
 * English password on its own is perfectly fine too — the env value never
 * needs to be a hash.)
 *
 * Cookies never hold the password: they hold an HMAC derived from it, so a
 * stolen cookie cannot be reversed back to the password, and only someone
 * who knows a valid password can mint a cookie.
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

/**
 * Split the raw env value into individual passwords.
 * Commas separate passwords; surrounding whitespace is ignored.
 */
export function passwordList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
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

/** Derive the session token for every configured password. */
export async function sessionTokens(rawEnv: string | undefined): Promise<string[]> {
  const out: string[] = [];
  for (const password of passwordList(rawEnv)) {
    out.push(await sessionToken(password));
  }
  return out;
}

/** Constant-time-ish comparison of two strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True when the cookie holds a session token derived from ANY configured
 * password. Always false when no password is configured (the caller treats
 * "no password" as open access).
 */
export async function isValidSession(
  cookieValue: string | undefined,
  rawEnv: string | undefined,
): Promise<boolean> {
  if (!cookieValue) return false;
  const tokens = await sessionTokens(rawEnv);
  if (tokens.length === 0) return false;

  // Compare against every token so timing does not reveal which one matched.
  let ok = false;
  for (const token of tokens) {
    if (safeEqual(cookieValue, token)) ok = true;
  }
  return ok;
}
