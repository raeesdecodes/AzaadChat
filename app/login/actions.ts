'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { SESSION_COOKIE, sessionToken, passwordList } from '@/lib/auth';
import { signIn } from '@/auth';

const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function safeNext(raw: string | null): string {
  const value = (raw ?? '/').trim();
  // Only allow same-site relative redirects.
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.startsWith('/login')) return '/';
  return value;
}

export async function loginAction(formData: FormData): Promise<void> {
  const rawEnv = process.env.DASHBOARD_PASSWORD;
  const next = safeNext(String(formData.get('next') ?? ''));
  const attempt = String(formData.get('password') ?? '');
  const passwords = passwordList(rawEnv);

  if (passwords.length === 0) {
    // Nothing to authenticate against — let them straight in.
    redirect(next);
  }

  // Every configured password is accepted (env may hold several,
  // comma-separated). Compare against all of them.
  let matched: string | null = null;
  for (const candidate of passwords) {
    if (candidate.length === attempt.length && candidate === attempt) {
      matched = candidate;
    }
  }

  if (!matched) {
    const params = new URLSearchParams({ error: '1', next });
    redirect(`/login?${params.toString()}`);
  }

  const token = await sessionToken(matched);
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

/** v2 account sign-in (email + password) via Auth.js credentials. */
export async function credentialsLoginAction(formData: FormData): Promise<void> {
  const next = safeNext(String(formData.get('next') ?? ''));
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  try {
    await signIn('credentials', { email, password, redirectTo: next });
  } catch (error) {
    // AuthError = wrong credentials; NEXT_REDIRECT on success must propagate.
    if (error instanceof AuthError) {
      const params = new URLSearchParams({ error: '1', next });
      redirect(`/login?${params.toString()}`);
    }
    throw error;
  }
}
