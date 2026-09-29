import { getStore, DEFAULT_RETENTION_LIMIT } from '@/lib/store';
import { saveSettingsAction, clearAllDataAction } from './actions';
import DangerZone from '@/components/DangerZone';

export const dynamic = 'force-dynamic';

function statusDot(ok: boolean, label: string) {
  return (
    <span className={`pill ${ok ? 'ok' : 'off'}`}>
      {ok ? '● ' : '○ '}
      {label}
    </span>
  );
}

export default async function SettingsPage() {
  const store = getStore();
  let retention = DEFAULT_RETENTION_LIMIT;
  let webhookOverride = '';
  try {
    const raw = await store.getSetting('retention_limit');
    retention = raw ? parseInt(raw, 10) || DEFAULT_RETENTION_LIMIT : DEFAULT_RETENTION_LIMIT;
    webhookOverride = (await store.getSetting('webhook_url_override')) ?? '';
  } catch {
    // defaults stand
  }

  const vercelUrl = process.env.VERCEL_URL;
  const derivedWebhook = vercelUrl
    ? `https://${vercelUrl}/api/webhook`
    : webhookOverride || '';

  const checks = [
    { name: 'META_VERIFY_TOKEN', ok: !!process.env.META_VERIFY_TOKEN, note: 'required for webhook verification' },
    { name: 'META_PAGE_ACCESS_TOKEN', ok: !!process.env.META_PAGE_ACCESS_TOKEN, note: 'required for sending replies' },
    { name: 'META_APP_SECRET', ok: !!process.env.META_APP_SECRET, note: 'recommended: verifies webhook signatures' },
    { name: 'DATABASE_URL', ok: !!process.env.DATABASE_URL, note: 'recommended: Postgres (else local JSON, dev only)' },
  ];

  return (
    <div>
      <div className="page-head">
        <h1>Settings</h1>
        <p>Connection, data retention, and the danger zone.</p>
      </div>

      <section className="card">
        <h2>Webhook</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Paste this as the <strong>Callback URL</strong> in your Meta app&apos;s
          Webhooks settings, together with your verify token.
        </p>
        <div
          className="mono"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            padding: '0.7rem 0.9rem',
            wordBreak: 'break-all',
          }}
        >
          {derivedWebhook || (
            <span className="muted">
              Not deployed yet — set VERCEL_URL (automatic on Vercel) or enter
              your public URL below.
            </span>
          )}
        </div>
        <div style={{ marginTop: '0.6rem' }}>
          {statusDot(!!process.env.META_VERIFY_TOKEN, 'Verify token set')}
          {!process.env.META_VERIFY_TOKEN &&
            statusDot(false, 'Verify token missing')}
        </div>
        <p className="muted small">
          The verify token value itself is never displayed here — only whether
          it is set.
        </p>
      </section>

      <section className="card">
        <h2>Environment</h2>
        <ul className="checklist">
          {checks.map((c) => (
            <li key={c.name} style={{ padding: '0.5rem 0' }}>
              <div className="step-body">
                <code>{c.name}</code>{' '}
                <span className="muted small">{c.note}</span>
              </div>
              {statusDot(c.ok, c.ok ? 'set' : 'not set')}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Data retention</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          The activity log auto-prunes inside the write path — only the latest{' '}
          <strong>N</strong> events are ever kept. This is what keeps your free
          database tiny no matter how many messages you process.
        </p>
        <form action={saveSettingsAction}>
          <div className="form-grid">
            <label className="field">
              <span>Keep the latest N events (10 – 5000)</span>
              <input
                type="number"
                name="retention_limit"
                defaultValue={retention}
                min={10}
                max={5000}
                required
              />
            </label>
            <label className="field">
              <span>Webhook URL override (optional)</span>
              <input
                type="text"
                name="webhook_url_override"
                defaultValue={webhookOverride}
                placeholder="https://your-app.vercel.app/api/webhook"
                maxLength={300}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit">Save settings</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Danger zone</h2>
        <div className="danger-box">
          <DangerZone clearAction={clearAllDataAction} />
        </div>
      </section>
    </div>
  );
}
