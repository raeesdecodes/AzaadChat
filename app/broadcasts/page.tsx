import { getStore } from '@/lib/store';
import BroadcastForm from '@/components/BroadcastForm';

export const dynamic = 'force-dynamic';

export default async function BroadcastsPage({
  searchParams,
}: {
  searchParams: { sent?: string };
}) {
  const store = getStore();
  let audienceSize = 0;
  let history: Awaited<ReturnType<typeof store.recentEvents>> = [];
  let storeError: string | null = null;
  try {
    const contacts = await store.listContacts('', 5000);
    audienceSize = contacts.filter(
      (c) =>
        (c.channel === 'instagram_dm' || c.channel === 'facebook_message') &&
        !c.senderId.startsWith('comment:'),
    ).length;
    const events = await store.recentEvents(100);
    history = events.filter((e) => e.type === 'broadcast');
  } catch (err) {
    storeError = (err as Error).message;
  }

  const tokenSet = !!process.env.META_PAGE_ACCESS_TOKEN;

  return (
    <div>
      <div className="page-head">
        <h1>Broadcasts</h1>
        <p>Send one message to many contacts at once.</p>
      </div>

      {searchParams.sent && (
        <div className="info" style={{ marginBottom: '1rem' }}>
          Broadcast queued — check the log below for per-recipient results.
        </div>
      )}

      <div className="warn" style={{ marginBottom: '1.25rem' }}>
        <strong>Meta&apos;s 24-hour messaging window:</strong> standard messages
        can only reach people who messaged you in the last 24 hours. Recipients
        outside that window will fail — those failures are logged below, and
        nothing else breaks. Keep broadcasts relevant and infrequent.
      </div>

      {storeError && <div className="warn">Could not load data: {storeError}</div>}

      <section className="card">
        <h2>Compose broadcast</h2>
        {!tokenSet && (
          <div className="warn" style={{ marginBottom: '1rem' }}>
            <code>META_PAGE_ACCESS_TOKEN</code> is not set — sending is
            disabled. <a href="/setup">See setup →</a>
          </div>
        )}
        <BroadcastForm audienceSize={audienceSize} tokenSet={tokenSet} />
      </section>

      <section className="card">
        <h2>Broadcast history</h2>
        {history.length === 0 ? (
          <p className="muted">No broadcasts sent yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Time</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {history.map((e) => (
                <tr key={e.id}>
                  <td className="muted small">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="small">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
