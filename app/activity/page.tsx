import { getStore, DEFAULT_RETENTION_LIMIT } from '@/lib/store';
import { channelLabel, type TriggerChannel } from '@/lib/triggers';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const store = getStore();
  let events: Awaited<ReturnType<typeof store.recentEvents>> = [];
  let retention = DEFAULT_RETENTION_LIMIT;
  let storeError: string | null = null;
  try {
    events = await store.recentEvents(200);
    const raw = await store.getSetting('retention_limit');
    retention = raw ? parseInt(raw, 10) || DEFAULT_RETENTION_LIMIT : DEFAULT_RETENTION_LIMIT;
  } catch (err) {
    storeError = (err as Error).message;
  }

  return (
    <div>
      <div className="page-head">
        <h1>Activity</h1>
        <p>
          Everything ChatAzad sees and does. The log{' '}
          <strong>auto-prunes to the latest {retention} events</strong> — old
          entries are deleted automatically to keep your database tiny and
          free-tier friendly.
        </p>
      </div>

      {storeError && <div className="warn">Could not load events: {storeError}</div>}

      {events.length === 0 && !storeError ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <p>
            No activity yet. Comment a keyword on one of your posts or send a
            DM to see events appear here.
          </p>
        </div>
      ) : (
        <section className="card" style={{ padding: '0.5rem 1.5rem' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Channel</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span className={`pill ${e.type}`}>{e.type}</span>
                  </td>
                  <td className="small">
                    {channelLabel(e.channel as TriggerChannel)}
                  </td>
                  <td className="small">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
