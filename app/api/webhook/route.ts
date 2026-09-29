/**
 * Meta webhook endpoint.
 *
 * GET  /api/webhook — verification handshake when you register the callback
 *                      URL in the Meta developer dashboard.
 * POST /api/webhook — receives Instagram + Facebook Page events.
 *
 * The POST handler logs events and upserts contacts, then awaits automation
 * before answering 200. Automation order per event:
 *   1. visual flows (first enabled flow whose trigger node matches)
 *   2. legacy quick-reply keyword triggers (fallback)
 * Errors are logged, never thrown.
 */
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getStore } from '@/lib/store';
import {
  findMatchingTrigger,
  type Trigger,
  type TriggerChannel,
} from '@/lib/triggers';
import {
  findMatchingFlow,
  executeFlow,
  type Flow,
  type FlowNode,
} from '@/lib/flows';
import {
  verifyWebhookSignature,
  sendInstagramDM,
  sendFacebookMessage,
  replyToComment,
  sendPrivateReply,
} from '@/lib/meta';

interface NormalizedEvent {
  channel: TriggerChannel;
  platform: 'instagram' | 'facebook';
  text: string;
  senderId: string; // DM sender (scoped ID) or `comment:<from>` for comments
  senderName?: string;
  commentId?: string; // comment to reply to
  summary: string;
}

// ---------------------------------------------------------------------------
// GET — webhook verification
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<Response> {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (
    mode === 'subscribe' &&
    verifyToken &&
    token === verifyToken &&
    challenge
  ) {
    console.log('[webhook] verification succeeded');
    return new Response(challenge, { status: 200 });
  }

  console.warn('[webhook] verification failed');
  return new Response('Forbidden', { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — event intake
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<Response> {
  const raw = await req.text();

  // Optional but recommended: verify Meta's signature.
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const signature = req.headers.get('x-hub-signature-256');
    if (!verifyWebhookSignature(raw, signature, appSecret)) {
      console.warn('[webhook] invalid X-Hub-Signature-256; rejecting');
      return new Response('Invalid signature', { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const events = normalizePayload(body);
  const store = getStore();

  // Log every event + capture the sender as a contact (awaited — fast).
  for (const ev of events) {
    try {
      await store.logEvent('webhook', ev.channel, ev.summary);
    } catch (err) {
      console.error('[webhook] failed to log event', err);
    }
    try {
      await store.upsertContact({
        platform: ev.platform,
        senderId: ev.senderId,
        name: ev.senderName ?? null,
        channel: ev.channel,
      });
    } catch (err) {
      console.error('[webhook] failed to upsert contact', err);
    }
  }

  // Run automation before responding; serverless runtimes may freeze afterward.
  try {
    await processEvents(events);
  } catch (err) {
    console.error('[webhook] background processing failed', err);
  }

  return new Response('EVENT_RECEIVED', { status: 200 });
}

/**
 * Flatten Meta's webhook payload into a uniform event list.
 * Supports:
 *  - object=instagram: entry[].messaging[] (DMs), entry[].changes[] (comments)
 *  - object=page:      entry[].messaging[] (Page messages), entry[].changes[]
 *                      with field=feed/item=comment (Page comments)
 */
function normalizePayload(body: unknown): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  if (typeof body !== 'object' || body === null) return events;
  const payload = body as { object?: string; entry?: Array<Record<string, unknown>> };
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const platform: 'instagram' | 'facebook' =
    payload.object === 'instagram' ? 'instagram' : 'facebook';

  for (const entry of entries) {
    // ---- direct messages (Instagram + Messenger share this shape) ----
    const messaging = entry.messaging;
    if (Array.isArray(messaging)) {
      for (const m of messaging as Array<Record<string, any>>) {
        if (m.message?.is_echo) continue; // our own sent messages
        const text: string | undefined = m.message?.text;
        if (!text) continue; // ignore stickers/attachments
        const senderId: string | undefined = m.sender?.id;
        if (!senderId) continue;
        const channel: TriggerChannel =
          platform === 'instagram' ? 'instagram_dm' : 'facebook_message';
        events.push({
          channel,
          platform,
          text,
          senderId,
          summary: `${channel === 'instagram_dm' ? 'IG DM' : 'FB message'} from ${senderId}: ${text.slice(0, 120)}`,
        });
      }
    }

    // ---- comments (Instagram changes + Facebook feed changes) ----
    const changes = entry.changes;
    if (Array.isArray(changes)) {
      for (const change of changes as Array<{ field?: string; value?: any }>) {
        const v = change.value ?? {};

        if (change.field === 'comments' && typeof v.text === 'string') {
          // Instagram comment webhook
          const from = String(v.from?.username ?? v.from?.id ?? 'unknown');
          events.push({
            channel: 'instagram_comment',
            platform: 'instagram',
            text: v.text,
            senderId: `comment:${from}`,
            senderName: v.from?.username ? `@${v.from.username}` : undefined,
            commentId: String(v.id),
            summary: `IG comment by @${from}: ${v.text.slice(0, 120)}`,
          });
        } else if (
          change.field === 'feed' &&
          v.item === 'comment' &&
          v.verb === 'add' &&
          typeof v.message === 'string'
        ) {
          // Facebook Page comment webhook
          const from = String(v.from?.name ?? v.from?.id ?? 'unknown');
          events.push({
            channel: 'facebook_comment',
            platform: 'facebook',
            text: v.message,
            senderId: `comment:${from}`,
            senderName: v.from?.name,
            commentId: String(v.comment_id),
            summary: `FB comment by ${from}: ${v.message.slice(0, 120)}`,
          });
        }
      }
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Automation processing
// ---------------------------------------------------------------------------
async function processEvents(events: NormalizedEvent[]): Promise<void> {
  const store = getStore();
  let triggers: Trigger[] = [];
  let flows: Flow[] = [];
  try {
    [triggers, flows] = await Promise.all([
      store.listTriggers(),
      store.listFlows(),
    ]);
  } catch (err) {
    console.error('[webhook] could not load automation', err);
    return;
  }

  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    console.warn('[webhook] META_PAGE_ACCESS_TOKEN not set — skipping sends');
  }

  for (const ev of events) {
    // 1) Visual flows first.
    const flowMatch = findMatchingFlow(flows, ev.channel, ev.text);
    if (flowMatch) {
      await runFlow(ev, flowMatch.flow, flowMatch.triggerNode, token, store);
      continue;
    }

    // 2) Legacy quick-reply triggers as fallback.
    const trigger = findMatchingTrigger(triggers, ev.channel, ev.text);
    if (!trigger) continue;

    try {
      await store.logEvent(
        'trigger_matched',
        ev.channel,
        `Matched "${trigger.keyword}" (${trigger.matchType}) on ${ev.channel}`,
      );
    } catch (err) {
      console.error('[webhook] failed to log trigger match', err);
    }

    try {
      await executeTrigger(trigger, ev, token, store);
      console.log(`[webhook] executed trigger "${trigger.keyword}" on ${ev.channel}`);
    } catch (err) {
      console.error('[webhook] trigger action failed', err);
      try {
        await store.logEvent(
          'error',
          ev.channel,
          `Failed to run trigger "${trigger.keyword}": ${(err as Error).message}`,
        );
      } catch {
        // logging failed; nothing more we can do
      }
    }
  }
}

async function runFlow(
  ev: NormalizedEvent,
  flow: Flow,
  triggerNode: FlowNode,
  token: string | undefined,
  store: ReturnType<typeof getStore>,
): Promise<void> {
  try {
    await store.logEvent(
      'flow_executed',
      ev.channel,
      `Flow "${flow.name}" started on ${ev.channel}`,
    );
  } catch (err) {
    console.error('[webhook] failed to log flow start', err);
  }

  if (!token) {
    // Flow matched, but nothing can be sent — say so instead of going quiet.
    try {
      await store.logEvent(
        'error',
        ev.channel,
        `Flow "${flow.name}" matched but META_PAGE_ACCESS_TOKEN is not set — no messages sent. See Setup →`,
      );
    } catch {
      // logging failed; nothing more we can do
    }
    return;
  }

  const deps = {
    sendDM: async (recipientId: string, text: string) => {
      const res =
        ev.channel === 'instagram_dm'
          ? await sendInstagramDM(recipientId, text, token)
          : await sendFacebookMessage(recipientId, text, token);
      await store
        .logEvent('message_sent', ev.channel, `Flow "${flow.name}" → DM to ${recipientId}`)
        .catch(() => {});
      return res;
    },
    sendCommentReply: async (commentId: string, text: string) => {
      const res = await replyToComment(commentId, text, token);
      await store
        .logEvent('message_sent', ev.channel, `Flow "${flow.name}" → reply to comment ${commentId}`)
        .catch(() => {});
      return res;
    },
    sendPrivateReply: async (commentId: string, text: string) => {
      const res = await sendPrivateReply(commentId, text, token);
      await store
        .logEvent('message_sent', ev.channel, `Flow "${flow.name}" → private reply for ${commentId}`)
        .catch(() => {});
      return res;
    },
  };

  try {
    const actions = await executeFlow(flow, triggerNode, ev, deps, (m) =>
      console.log(`[webhook:flow:${flow.name}] ${m}`),
    );
    console.log(`[webhook] flow "${flow.name}" done (${actions} sends)`);
  } catch (err) {
    console.error('[webhook] flow execution failed', err);
    try {
      await store.logEvent(
        'error',
        ev.channel,
        `Flow "${flow.name}" failed: ${(err as Error).message}`,
      );
    } catch {
      // logging failed; nothing more we can do
    }
  }
}

async function executeTrigger(
  trigger: Trigger,
  ev: NormalizedEvent,
  token: string | undefined,
  store: ReturnType<typeof getStore>,
): Promise<void> {
  if (!token) {
    console.warn('[webhook] META_PAGE_ACCESS_TOKEN not set — skipping send');
    return;
  }

  switch (ev.channel) {
    case 'instagram_dm':
      await sendInstagramDM(ev.senderId, trigger.replyText, token);
      break;
    case 'facebook_message':
      await sendFacebookMessage(ev.senderId, trigger.replyText, token);
      break;
    case 'instagram_comment':
    case 'facebook_comment': {
      if (!ev.commentId) return;
      if (trigger.action === 'private_reply') {
        await sendPrivateReply(ev.commentId, trigger.replyText, token);
      } else {
        await replyToComment(ev.commentId, trigger.replyText, token);
      }
      break;
    }
  }

  try {
    await store.logEvent(
      'message_sent',
      ev.channel,
      `Trigger "${trigger.keyword}" → reply sent on ${ev.channel}`,
    );
  } catch (err) {
    console.error('[webhook] failed to log message_sent', err);
  }
}
