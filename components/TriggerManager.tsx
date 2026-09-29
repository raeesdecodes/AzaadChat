'use client';

import { useState } from 'react';
import {
  channelLabel,
  actionLabel,
  type Trigger,
  type MatchType,
  type TriggerChannel,
  type TriggerAction,
} from '@/lib/triggers';

interface Props {
  initial: Trigger[];
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (id: string, formData: FormData) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}

const MATCH_TYPES: MatchType[] = ['exact', 'contains', 'starts_with'];
const CHANNELS: TriggerChannel[] = [
  'instagram_dm',
  'instagram_comment',
  'facebook_message',
  'facebook_comment',
  'any',
];
const ACTIONS: TriggerAction[] = ['send_text', 'private_reply'];

function TriggerFormFields({ trigger }: { trigger?: Trigger }) {
  return (
    <>
      <label className="field">
        <span>Keyword</span>
        <input
          name="keyword"
          required
          defaultValue={trigger?.keyword ?? ''}
          placeholder="e.g. LINK"
        />
      </label>
      <label className="field">
        <span>Match type</span>
        <select name="matchType" defaultValue={trigger?.matchType ?? 'contains'}>
          {MATCH_TYPES.map((m) => (
            <option key={m} value={m}>
              {m.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Channel</span>
        <select name="channel" defaultValue={trigger?.channel ?? 'any'}>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {channelLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Action</span>
        <select name="action" defaultValue={trigger?.action ?? 'send_text'}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {actionLabel(a)}
            </option>
          ))}
        </select>
      </label>
      <label className="field wide">
        <span>Reply text</span>
        <textarea
          name="replyText"
          required
          rows={2}
          defaultValue={trigger?.replyText ?? ''}
          placeholder="The message to send when the keyword matches…"
        />
      </label>
      <label className="check wide">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={trigger?.enabled ?? true}
        />
        Enabled
      </label>
    </>
  );
}

export default function TriggerManager({
  initial,
  createAction,
  updateAction,
  deleteAction,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(initial.length === 0);

  return (
    <div>
      {initial.length === 0 && !showAdd && (
        <div className="empty">
          <div className="empty-icon">⚡</div>
          <p>No quick replies yet. Add your first keyword automation below.</p>
        </div>
      )}

      <ul className="row-list">
        {initial.map((t) => (
          <li key={t.id} className={`row-card ${t.enabled ? '' : 'disabled'}`}>
            {editingId === t.id ? (
              <form
                className="form-grid"
                style={{ width: '100%' }}
                action={async (fd) => {
                  await updateAction(t.id, fd);
                  setEditingId(null);
                }}
              >
                <TriggerFormFields trigger={t} />
                <div className="form-actions wide">
                  <button type="submit">Save</button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="row-main">
                  <strong>“{t.keyword}”</strong>
                  <span className="pill">{t.matchType.replace('_', ' ')}</span>
                  <span className="pill">{channelLabel(t.channel)}</span>
                  <span className="pill">{actionLabel(t.action)}</span>
                  {!t.enabled && <span className="pill off">disabled</span>}
                  <div className="reply-preview">{t.replyText}</div>
                </div>
                <div className="row-ops">
                  <button className="ghost small" onClick={() => setEditingId(t.id)}>
                    Edit
                  </button>
                  <button
                    className="danger small"
                    onClick={async () => {
                      if (confirm(`Delete trigger "${t.keyword}"?`)) {
                        await deleteAction(t.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {showAdd ? (
        <form
          className="form-grid card"
          style={{ marginTop: '1rem' }}
          action={async (fd) => {
            await createAction(fd);
            setShowAdd(false);
          }}
        >
          <h3 className="wide" style={{ margin: 0 }}>
            New quick reply
          </h3>
          <TriggerFormFields />
          <div className="form-actions wide">
            <button type="submit">Add quick reply</button>
            {initial.length > 0 && (
              <button
                type="button"
                className="ghost"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <button style={{ marginTop: '0.5rem' }} onClick={() => setShowAdd(true)}>
          + Add quick reply
        </button>
      )}
    </div>
  );
}
