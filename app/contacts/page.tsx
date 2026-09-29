import { getStore } from '@/lib/store';
import { channelLabel, type TriggerChannel } from '@/lib/triggers';

export const dynamic = 'force-dynamic';

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q ?? '';
  const store = getStore();
  let contacts: Awaited<ReturnType<typeof store.listContacts>> = [];
  let storeError: string | null = null;
  try {
    contacts = await store.listContacts(q, 200);
  } catch (err) {
    storeError = (err as Error).message;
  }

  return (
    <div>
      <div className="page-head">
        <h1>Contacts</h1>
        <p>
          Every unique sender captured from incoming webhooks — DMs and
          comments. Only contacts who DM&apos;d you can receive broadcasts.
        </p>
      </div>

      <div className="toolbar">
        <form method="get" style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            name="q"
            placeholder="Search name, ID, platform…"
            defaultValue={q}
            className="search"
          />
          <button type="submit" className="ghost">
            Search
          </button>
        </form>
        <span className="spacer" />
        <span className="muted small">
          {contacts.length} contact{contacts.length === 1 ? '' : 's'}
          {q ? ` matching “${q}”` : ''}
        </span>
      </div>

      {storeError && <div className="warn">Could not load contacts: {storeError}</div>}

      {contacts.length === 0 && !storeError ? (
        <div className="empty">
          <div className="empty-icon">👥</div>
          <p>
            No contacts yet. They appear here automatically the first time
            someone messages or comments.
          </p>
        </div>
      ) : (
        <section className="card" style={{ padding: '0.5rem 1.5rem' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Name / ID</th>
                <th>Platform</th>
                <th>Last channel</th>
                <th>Messages</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name ?? '—'}</strong>
                    <div className="muted small mono">{c.senderId}</div>
                  </td>
                  <td>
                    <span className="pill">{PLATFORM_LABEL[c.platform]}</span>
                  </td>
                  <td className="small">{channelLabel(c.channel as TriggerChannel)}</td>
                  <td>{c.messageCount}</td>
                  <td className="muted small">
                    {new Date(c.lastSeenAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
