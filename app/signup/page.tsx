import Link from 'next/link';
import { signupAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Create account — ChatAzad',
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  email: 'Enter a valid email address.',
  short: `Password must be at least 8 characters.`,
  mismatch: 'Passwords do not match.',
  exists: 'An account with this email already exists.',
};

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const next = searchParams.next ?? '/';
  const error = searchParams.error ? ERRORS[searchParams.error] : undefined;

  return (
    <div className="login-wrap">
      <div className="login-card card">
        <div className="brand" style={{ padding: '0 0 1rem', borderBottom: 'none' }}>
          <span className="brand-mark">CZ</span>
          <span className="brand-name">ChatAzad</span>
        </div>

        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.35rem' }}>
          Create your account
        </h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          Email + password sign-in for the ChatAzad dashboard.
        </p>

        {error ? (
          <div className="warn" style={{ marginTop: '0.9rem' }}>
            {error}
          </div>
        ) : null}

        <form action={signupAction} style={{ marginTop: '1rem' }}>
          <input type="hidden" name="next" value={next} />
          <label className="small muted" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            style={{ width: '100%', marginTop: '0.35rem' }}
          />

          <label className="small muted" htmlFor="password" style={{ display: 'block', marginTop: '0.8rem' }}>
            Password (min 8 characters)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            style={{ width: '100%', marginTop: '0.35rem' }}
          />

          <label className="small muted" htmlFor="confirm" style={{ display: 'block', marginTop: '0.8rem' }}>
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            style={{ width: '100%', marginTop: '0.35rem' }}
          />

          <button
            type="submit"
            className="btn"
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Create account
          </button>
        </form>

        <p className="muted small" style={{ marginTop: '1.25rem' }}>
          Already have an account? <Link href="/login">Sign in</Link>
          {' · '}
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
