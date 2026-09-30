import Link from 'next/link';
import { loginAction, credentialsLoginAction } from './actions';
import { passwordList } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in — ChatAzad',
  robots: { index: false },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string; created?: string };
}) {
  const configured = !!process.env.DASHBOARD_PASSWORD;
  const passwordCount = passwordList(process.env.DASHBOARD_PASSWORD).length;
  const next = searchParams.next ?? '/';

  return (
    <div className="login-wrap">
      <div className="login-card card">
        <div className="brand" style={{ padding: '0 0 1rem', borderBottom: 'none' }}>
          <span className="brand-mark">CZ</span>
          <span className="brand-name">ChatAzad</span>
        </div>

        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.35rem' }}>
          {configured ? 'Enter dashboard password' : 'Dashboard'}
        </h1>

        {searchParams.created ? (
          <div
            className="small"
            style={{ marginTop: '0.5rem', color: '#16a34a' }}
          >
            Account created — sign in below.
          </div>
        ) : null}

        {configured ? (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              {passwordCount > 1
                ? 'This dashboard is password-protected — any of your configured passwords will work.'
                : 'This dashboard is password-protected.'}
            </p>

            {searchParams.error ? (
              <div className="warn" style={{ marginTop: '0.9rem' }}>
                Wrong password. Try again.
              </div>
            ) : null}

            <form action={loginAction} style={{ marginTop: '1rem' }}>
              <input type="hidden" name="next" value={next} />
              <label className="small muted" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                required
                style={{ width: '100%', marginTop: '0.35rem' }}
              />
              <button
                type="submit"
                className="btn"
                style={{ width: '100%', marginTop: '1rem' }}
              >
                Sign in
              </button>
            </form>
          </>
        ) : (
          <p className="muted small">
            No <code>DASHBOARD_PASSWORD</code> is configured, so the dashboard
            is open. Set the variable in Vercel to lock it.
          </p>
        )}

        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(148,163,184,0.25)' }}>
          <p className="small muted" style={{ marginTop: 0 }}>
            {configured ? 'or ' : ''}sign in with your ChatAzad account
          </p>

          <form action={credentialsLoginAction}>
            <input type="hidden" name="next" value={next} />
            <label className="small muted" htmlFor="account-email">
              Email
            </label>
            <input
              id="account-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              style={{ width: '100%', marginTop: '0.35rem' }}
            />

            <label
              className="small muted"
              htmlFor="account-password"
              style={{ display: 'block', marginTop: '0.8rem' }}
            >
              Password
            </label>
            <input
              id="account-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              style={{ width: '100%', marginTop: '0.35rem' }}
            />

            <button
              type="submit"
              className="btn"
              style={{ width: '100%', marginTop: '1rem' }}
            >
              Sign in
            </button>
          </form>

          <p className="small muted" style={{ marginTop: '0.8rem' }}>
            New here?{' '}
            <Link href={`/signup?next=${encodeURIComponent(next)}`}>
              Create an account
            </Link>
          </p>
        </div>

        <p className="muted small" style={{ marginTop: '1.25rem' }}>
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
