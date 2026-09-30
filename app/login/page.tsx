import Link from 'next/link';
import { loginAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in — ChatAzad',
  robots: { index: false },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const configured = !!process.env.DASHBOARD_PASSWORD;
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

        {configured ? (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              This dashboard is password-protected.
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

        <p className="muted small" style={{ marginTop: '1.25rem' }}>
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
