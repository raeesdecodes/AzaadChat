import Link from 'next/link';
import { getStore } from '@/lib/store';
import { channelLabel, type TriggerChannel } from '@/lib/triggers';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const store = getStore();

  let stats = {
    messagesSent: 0,
    triggersMatched: 0,
    flowsExecuted: 0,
    activeFlows: 0,
    totalContacts: 0,
    totalEvents: 0,
  };
  let events: Awaited<ReturnType<typeof store.recentEvents>> = [];
  let storeError: string | null = null;
  try {
    [stats, events] = await Promise.all([
      store.getStats(),
      store.recentEvents(8),
    ]);
  } catch (err) {
    storeError = (err as Error).message;
  }

  const envOk =
    !!process.env.META_VERIFY_TOKEN && !!process.env.META_PAGE_ACCESS_TOKEN;

  const cards = [
    {
      num: stats.messagesSent,
      label: 'Messages sent',
      sub: 'auto-replies delivered via API',
    },
    {
      num: stats.triggersMatched + stats.flowsExecuted,
      label: 'Automations fired',
      sub: `${stats.flowsExecuted} flows · ${stats.triggersMatched} quick replies`,
    },
    { num: stats.activeFlows, label: 'Active flows', sub: 'visual flows enabled' },
    {
      num: stats.totalContacts,
      label: 'Contacts',
      sub: 'unique senders captured',
    },
  ];

  return (
    <div>
      <div className="page-head">
        <h1>Overview</h1>
        <p>Your Instagram &amp; Facebook automation at a glance.</p>
      </div>

      {storeError && <div className="warn">Could not load stats: {storeError}</div>}

      {!envOk && (
        <div className="warn">
          Webhook verification and sending need <code>META_VERIFY_TOKEN</code>{' '}
          and <code>META_PAGE_ACCESS_TOKEN</code>.{' '}
          <Link href="/setup">Follow the setup wizard →</Link>
        </div>
      )}

      <div className="stat-grid">
        {cards.map((c) => (
          <div className="stat" key={c.label}>
            <div className="stat-num">{c.num.toLocaleString()}</div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <section className="card">
        <h2>Get started</h2>
        <p className="muted">
          Build a visual automation flow, add a quick keyword reply, or send a
          broadcast to your contacts.
        </p>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <Link href="/flows" className="btn">
            + New flow
          </Link>
          <Link href="/quick-replies" className="btn ghost">
            Quick replies
          </Link>
          <Link href="/broadcasts" className="btn ghost">
            Send broadcast
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>Recent activity</h2>
          <span className="spacer" />
          <Link href="/activity" className="btn ghost small">
            View all
          </Link>
        </div>
        {events.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <p>
              Nothing yet. Comment a keyword on one of your posts or send a DM
              to see activity appear here.
            </p>
          </div>
        ) : (
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
                  <td className="muted small">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span className={`pill ${e.type}`}>{e.type}</span>
                  </td>
                  <td className="small">{channelLabel(e.channel as TriggerChannel)}</td>
                  <td className="small">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="page-foot">
        ChatAzad · MIT licensed · Webhook endpoint <code>/api/webhook</code>
      </footer>
    </div>
  );
}
