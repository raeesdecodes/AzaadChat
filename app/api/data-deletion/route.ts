/**
 * Meta "Data Deletion Request" callback.
 *
 * Meta POSTs a form-encoded `signed_request` here when a person removes the
 * app from their Facebook/Instagram account. We:
 *   1. verify the signature with META_APP_SECRET (HMAC-SHA256),
 *   2. delete the stored records belonging to that user id,
 *   3. answer with `{url, confirmation_code}` as Meta requires.
 *
 * The confirmation code is kept in `settings` under `deletion:<user_id>` so it
 * can be looked up later when Meta or the user asks for it again.
 *
 * No secret is ever echoed back in the response.
 */
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getStore } from '@/lib/store';

interface DeletionPayload {
  user_id?: string;
  algorithm?: string;
  issued_at?: number | string;
  redirect_url?: string;
}

function base64urlDecode(input: string): Buffer {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64');
}

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Parse + signature-check a Meta `signed_request`. Returns null when invalid. */
function parseSignedRequest(
  signed: string,
  appSecret: string,
): DeletionPayload | null {
  const sep = signed.indexOf('.');
  if (sep <= 0) return null;

  const encodedPayload = signed.slice(0, sep);
  const providedSig = signed.slice(sep + 1);
  if (!providedSig) return null;

  const expected = base64urlEncode(
    crypto
      .createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest(),
  );

  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload).toString('utf8'));
    return typeof payload === 'object' && payload !== null
      ? (payload as DeletionPayload)
      : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const appSecret = process.env.META_APP_SECRET;

  let signed = '';
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      signed = String(form.get('signed_request') ?? '');
    } else if (contentType.includes('application/json')) {
      const body = (await req.json()) as { signed_request?: unknown };
      signed = String(body.signed_request ?? '');
    } else {
      signed = req.nextUrl.searchParams.get('signed_request') ?? '';
    }
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  if (!signed) {
    return Response.json({ error: 'missing_signed_request' }, { status: 400 });
  }

  if (!appSecret) {
    // Without META_APP_SECRET we cannot authenticate the request — refuse
    // rather than delete data on an unverified call.
    console.warn('[data-deletion] META_APP_SECRET not set; refusing request');
    return Response.json({ error: 'server_not_configured' }, { status: 503 });
  }

  const payload = parseSignedRequest(signed, appSecret);
  if (!payload) {
    console.warn('[data-deletion] invalid signed_request; rejecting');
    return Response.json({ error: 'invalid_signature' }, { status: 403 });
  }

  const userId = String(payload.user_id ?? '').trim();
  if (!userId) {
    return Response.json({ error: 'missing_user_id' }, { status: 400 });
  }

  const confirmationCode = crypto.randomBytes(16).toString('hex');
  const store = getStore();

  try {
    const result = await store.deleteUserData(userId);
    console.log(
      `[data-deletion] user=${userId} contacts=${result.contactsDeleted} events=${result.eventsDeleted}`,
    );
  } catch (err) {
    console.error('[data-deletion] store deletion failed', err);
    return Response.json({ error: 'deletion_failed' }, { status: 500 });
  }

  try {
    await store.setSetting(
      `deletion:${userId}`,
      JSON.stringify({
        confirmation_code: confirmationCode,
        deleted_at: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.error('[data-deletion] could not persist confirmation code', err);
  }

  try {
    await store.logEvent(
      'system',
      'system',
      `Data deletion request fulfilled for user ${userId}`,
    );
  } catch {
    // logging is best-effort
  }

  const statusUrl = new URL('/api/data-deletion', req.nextUrl.origin);
  statusUrl.searchParams.set('user_id', userId);

  return Response.json({
    url: statusUrl.toString(),
    confirmation_code: confirmationCode,
  });
}

/** Lookup endpoint: Meta or the user can re-check a confirmation code. */
export async function GET(req: NextRequest): Promise<Response> {
  const userId = req.nextUrl.searchParams.get('user_id')?.trim();
  if (!userId) {
    return Response.json({ error: 'missing_user_id' }, { status: 400 });
  }

  try {
    const raw = await getStore().getSetting(`deletion:${userId}`);
    if (!raw) {
      return Response.json({ found: false });
    }
    const record = JSON.parse(raw) as {
      confirmation_code?: string;
      deleted_at?: string;
    };
    return Response.json({
      found: true,
      status_url: req.nextUrl.origin + '/api/data-deletion',
      confirmation_code: record.confirmation_code ?? null,
      deleted_at: record.deleted_at ?? null,
    });
  } catch (err) {
    console.error('[data-deletion] lookup failed', err);
    return Response.json({ error: 'lookup_failed' }, { status: 500 });
  }
}
