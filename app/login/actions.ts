'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, sessionToken } from '@/lib/auth';

const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function safeNext(raw: string | null): string {
  const value = (raw ?? '/').trim();
  // Only allow same-site relative redirects.
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.startsWith('/login')) return '/';
  return value;
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = process.env.DASHBOARD_PASSWORD;
  const next = safeNext(String(formData.get('next') ?? ''));
  const attempt = String(formData.get('password') ?? '');

  if (!password) {
    // Nothing to authenticate against — let them straight in.
    redirect(next);
  }

  if (attempt !== password) {
    const params = new URLSearchParams({ error: '1', next });
    redirect(`/login?${params.toString()}`);
  }

  const token = await sessionToken(password);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });

  redirect(next);
}

export async function logoutAction(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
  redirect('/login');
}
