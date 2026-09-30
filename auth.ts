/**
 * Auth.js (next-auth v5) — credentials provider for ChatAzad accounts.
 *
 * This is the v2 multi-user auth layer on top of the v1 dashboard password
 * gate (lib/auth.ts). Both are accepted by middleware:
 *   - legacy:  cz_session cookie   (DASHBOARD_PASSWORD)
 *   - v2:      next-auth JWT cookie (email + password account)
 *
 * Session strategy: JWT. Passwords are bcrypt hashes stored in the `users`
 * table (or ./data/users.json in dev). Never log passwords or hashes.
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getStore } from '@/lib/store';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // v5 requires this behind Vercel/any host without AUTH_URL
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? '')
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        const user = await getStore().findUserByEmail(email);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
});
