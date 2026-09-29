'use client';

import { sendBroadcastAction } from '@/app/broadcasts/actions';

export default function BroadcastForm({
  audienceSize,
  tokenSet,
}: {
  audienceSize: number;
  tokenSet: boolean;
}) {
  return (
    <form
      action={sendBroadcastAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `Send this broadcast to ${audienceSize} contact${audienceSize === 1 ? '' : 's'}?`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>Audience</span>
          <select name="channel" defaultValue="all">
            <option value="all">All DM contacts ({audienceSize})</option>
            <option value="instagram_dm">Instagram DMs only</option>
            <option value="facebook_message">Facebook messages only</option>
          </select>
        </label>
        <div className="field">
          <span>Preview</span>
          <div className="muted small" style={{ paddingTop: '0.55rem' }}>
            {audienceSize} contact{audienceSize === 1 ? '' : 's'} will be
            targeted. Only people who DM&apos;d you can receive messages.
          </div>
        </div>
        <label className="field wide">
          <span>Message</span>
          <textarea
            name="message"
            required
            rows={4}
            maxLength={1000}
            placeholder="Write your broadcast message…"
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={!tokenSet || audienceSize === 0}>
          📣 Send broadcast
        </button>
      </div>
    </form>
  );
}
