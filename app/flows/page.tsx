import Link from 'next/link';
import { getStore } from '@/lib/store';
import { nodeTypeLabel } from '@/lib/flows';
import {
  createFlowAction,
  renameFlowAction,
  toggleFlowAction,
  duplicateFlowAction,
  deleteFlowAction,
} from './actions';
import FlowRowActions from '@/components/FlowRowActions';

export const dynamic = 'force-dynamic';

export default async function FlowsPage() {
  const store = getStore();
  let flows: Awaited<ReturnType<typeof store.listFlows>> = [];
  let storeError: string | null = null;
  try {
    flows = await store.listFlows();
  } catch (err) {
    storeError = (err as Error).message;
  }

  return (
    <div>
      <div className="page-head">
        <h1>Flows</h1>
        <p>
          Visual automations, ManyChat-style. When a trigger keyword matches,
          the flow runs its nodes in order. Flows are checked before quick
          replies.
        </p>
      </div>

      <div className="toolbar">
        <form action={createFlowAction} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            name="name"
            placeholder="New flow name…"
            style={{ maxWidth: 260 }}
            maxLength={80}
          />
          <button type="submit">+ New flow</button>
        </form>
      </div>

      {storeError && <div className="warn">Could not load flows: {storeError}</div>}

      {flows.length === 0 && !storeError ? (
        <div className="empty">
          <div className="empty-icon">🌊</div>
          <p>
            No flows yet. Create your first flow — e.g. a comment-to-DM
            automation: <strong>Trigger “LINK” → Private reply</strong>.
          </p>
        </div>
      ) : (
        <ul className="row-list">
          {flows.map((f) => (
            <li key={f.id} className={`row-card ${f.enabled ? '' : 'disabled'}`}>
              <div className="row-main">
                <strong>{f.name}</strong>{' '}
                {f.enabled ? (
                  <span className="pill ok">active</span>
                ) : (
                  <span className="pill off">paused</span>
                )}
                <div className="reply-preview">
                  {f.nodes.length} node{f.nodes.length === 1 ? '' : 's'} ·{' '}
                  {f.nodes
                    .map((n) => nodeTypeLabel(n.type))
                    .slice(0, 4)
                    .join(' → ')}
                  {f.nodes.length > 4 ? ' …' : ''}
                </div>
                <div className="muted small">
                  Updated {new Date(f.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="row-ops">
                <Link href={`/flows/${f.id}`} className="btn small">
                  Open builder
                </Link>
                <FlowRowActions
                  flowId={f.id}
                  flowName={f.name}
                  enabled={f.enabled}
                  renameAction={renameFlowAction}
                  toggleAction={toggleFlowAction}
                  duplicateAction={duplicateFlowAction}
                  deleteAction={deleteFlowAction}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
