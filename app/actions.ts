'use server';

import { revalidatePath } from 'next/cache';
import { getStore } from '@/lib/store';
import type {
  MatchType,
  TriggerChannel,
  TriggerAction,
} from '@/lib/triggers';

function parseForm(formData: FormData) {
  const keyword = String(formData.get('keyword') ?? '').trim();
  const matchType = String(formData.get('matchType') ?? 'contains') as MatchType;
  const channel = String(formData.get('channel') ?? 'any') as TriggerChannel;
  const replyText = String(formData.get('replyText') ?? '').trim();
  const action = String(formData.get('action') ?? 'send_text') as TriggerAction;
  const enabled = formData.get('enabled') === 'on';
  if (!keyword || !replyText) {
    throw new Error('Keyword and reply text are required.');
  }
  return { keyword, matchType, channel, replyText, action, enabled };
}

export async function createTriggerAction(formData: FormData): Promise<void> {
  const store = getStore();
  await store.createTrigger(parseForm(formData));
  revalidatePath('/quick-replies');
}

export async function updateTriggerAction(
  id: string,
  formData: FormData,
): Promise<void> {
  const store = getStore();
  await store.updateTrigger(id, parseForm(formData));
  revalidatePath('/quick-replies');
}

export async function deleteTriggerAction(id: string): Promise<void> {
  const store = getStore();
  await store.deleteTrigger(id);
  revalidatePath('/quick-replies');
}
