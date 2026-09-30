/**
 * Meta Graph API client (fetch-based, no SDK).
 *
 * All tokens come from environment variables — never hard-code them.
 * API version: v21.0.
 */
import crypto from 'crypto';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

/** Verify the X-Hub-Signature-256 header Meta attaches to webhook POSTs. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Turn Meta's error body into a short, human-readable reason.
 * Meta answers with {error:{message,type,code,error_subcode}} — surface it
 * so the Activity log shows *why* a send failed instead of a bare status code.
 */
function graphErrorDetail(data: unknown): string {
  if (data && typeof data === 'object') {
    const err = (data as { error?: Record<string, unknown> }).error;
    if (err && typeof err === 'object') {
      const message = typeof err.message === 'string' ? err.message : '';
      const type = typeof err.type === 'string' ? err.type : '';
      const code =
        typeof err.code === 'number' ? `#${err.code}` : '';
      const sub =
        typeof err.error_subcode === 'number' ? `.${err.error_subcode}` : '';
      const bits = [message, [type, code && sub ? code + sub : code].filter(Boolean).join(' ')]
        .map((s) => s.trim())
        .filter(Boolean);
      if (bits.length) return bits.join(' — ');
    }
    try {
      const raw = JSON.stringify(data);
      if (raw && raw !== '{}') return raw.slice(0, 300);
    } catch {
      // fall through
    }
  }
  return 'no error body returned by Meta';
}

async function graphPost(
  path: string,
  pageAccessToken: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${GRAPH_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: pageAccessToken }),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON error body; keep data as null
  }
  if (!res.ok) {
    const detail = graphErrorDetail(data);
    console.error(`[meta] POST ${path} failed (${res.status})`, data);
    throw new Error(`Graph API ${path} failed with status ${res.status}: ${detail}`);
  }
  console.log(`[meta] POST ${path} ok`);
  return data;
}

/**
 * Send an Instagram DM.
 * `recipientScopedId` is the sender.id from the webhook's messaging event
 * (an Instagram-scoped ID). Uses the Page access token of the Facebook Page
 * linked to the Instagram business/creator account.
 */
export function sendInstagramDM(
  recipientScopedId: string,
  text: string,
  pageAccessToken: string,
): Promise<unknown> {
  return graphPost('/me/messages', pageAccessToken, {
    recipient: { id: recipientScopedId },
    messaging_type: 'RESPONSE',
    message: { text },
  });
}

/** Send a Facebook Page message (Messenger). Same endpoint as Instagram DMs. */
export function sendFacebookMessage(
  recipientPageScopedId: string,
  text: string,
  pageAccessToken: string,
): Promise<unknown> {
  return graphPost('/me/messages', pageAccessToken, {
    recipient: { id: recipientPageScopedId },
    messaging_type: 'RESPONSE',
    message: { text },
  });
}

/** Public reply to a comment (works for IG + FB comments). */
export function replyToComment(
  commentId: string,
  text: string,
  pageAccessToken: string,
): Promise<unknown> {
  return graphPost(`/${commentId}/replies`, pageAccessToken, { message: text });
}

/**
 * Private reply: sends the commenter a DM instead of a public reply.
 * This is the classic ManyChat "comment LINK to get the link in DM" flow.
 * Works for both Instagram and Facebook comments.
 */
export function sendPrivateReply(
  commentId: string,
  text: string,
  pageAccessToken: string,
): Promise<unknown> {
  return graphPost(`/${commentId}/private_replies`, pageAccessToken, {
    message: text,
  });
}
