'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { getStore } from '@/lib/store';

const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorRedirect(next: string, error: string): never {
  const params = new URLSearchParams({ error, next });
  redirect(`/signup?${params.toString()}`);
}

export async function signupAction(formData: FormData): Promise<void> {
  const next = String(formData.get('next') ?? '/').trim() || '/';
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (!EMAIL_RE.test(email)) errorRedirect(next, 'email');
  if (password.length < MIN_PASSWORD) errorRedirect(next, 'short');
  if (password !== confirm) errorRedirect(next, 'mismatch');

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await getStore().createUser({ email, passwordHash });
  } catch {
    // UNIQUE violation (Postgres) or duplicate (JSON fallback)
    errorRedirect(next, 'exists');
  }

  const params = new URLSearchParams({ created: '1', next });
  redirect(`/login?${params.toString()}`);
}
