'use server';

import { revalidatePath } from 'next/cache';
import { getStore, DEFAULT_RETENTION_LIMIT } from '@/lib/store';

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const store = getStore();

  const retentionRaw = String(formData.get('retention_limit') ?? '').trim();
  const retention = parseInt(retentionRaw, 10);
  await store.setSetting(
    'retention_limit',
    String(
      Number.isFinite(retention)
        ? Math.min(Math.max(retention, 10), 5000)
        : DEFAULT_RETENTION_LIMIT,
    ),
  );

  const override = String(formData.get('webhook_url_override') ?? '').trim();
  await store.setSetting('webhook_url_override', override.slice(0, 300));

  // Immediately enforce the new retention on existing events.
  await store.logEvent('system', 'system', 'Settings updated');

  revalidatePath('/settings');
  revalidatePath('/activity');
}

export async function clearAllDataAction(): Promise<void> {
  await getStore().clearAll();
  revalidatePath('/');
  revalidatePath('/flows');
  revalidatePath('/quick-replies');
  revalidatePath('/contacts');
  revalidatePath('/activity');
  revalidatePath('/settings');
}
