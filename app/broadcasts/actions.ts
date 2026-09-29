'use server';

import { revalidatePath } from 'next/cache';
import { getStore } from '@/lib/store';
import { sendInstagramDM, sendFacebookMessage } from '@/lib/meta';

function broadcastable(contact: { channel: string; senderId: string }): boolean {
  return (
    (contact.channel === 'instagram_dm' || contact.channel === 'facebook_message') &&
    !contact.senderId.startsWith('comment:')
  );
}

export async function sendBroadcastAction(formData: FormData): Promise<void> {
  const message = String(formData.get('message') ?? '').trim();
  const channelFilter = String(formData.get('channel') ?? 'all');
  if (!message) throw new Error('Message text is required.');

  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'META_PAGE_ACCESS_TOKEN is not set — broadcasts cannot be sent.',
    );
  }

  const store = getStore();
  const all = await store.listContacts('', 5000);
  const audience = all.filter(
    (c) =>
      broadcastable(c) &&
      (channelFilter === 'all' || c.channel === channelFilter),
  );

  let sent = 0;
  let failed = 0;
  for (const c of audience) {
    try {
      if (c.channel === 'instagram_dm') {
        await sendInstagramDM(c.senderId, message, token);
      } else {
        await sendFacebookMessage(c.senderId, message, token);
      }
      sent++;
    } catch (err) {
      failed++;
      console.error(`[broadcast] failed for ${c.senderId}`, err);
      await store
        .logEvent(
          'error',
          c.channel,
          `Broadcast failed for ${c.name ?? c.senderId}: ${(err as Error).message}`,
        )
        .catch(() => {});
    }
  }

  await store.logEvent(
    'broadcast',
    'system',
    `Broadcast "${message.slice(0, 80)}${message.length > 80 ? '…' : ''}" → ${sent} sent, ${failed} failed (${audience.length} targeted)`,
  );

  revalidatePath('/broadcasts');
}
