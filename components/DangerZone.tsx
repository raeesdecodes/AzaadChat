'use client';

import { useState, useTransition } from 'react';

export default function DangerZone({
  clearAction,
}: {
  clearAction: () => Promise<void>;
}) {
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!armed) {
    return (
      <button className="danger" onClick={() => setArmed(true)}>
        Clear all data…
      </button>
    );
  }

  return (
    <div>
      <p className="small" style={{ marginTop: 0 }}>
        This permanently deletes <strong>all</strong> flows, quick replies,
        contacts and the activity log. This cannot be undone.
      </p>
      <div className="form-actions" style={{ marginTop: '0.5rem' }}>
        <button
          className="danger"
          disabled={isPending}
          onClick={() => {
            if (
              confirm(
                'Really delete EVERYTHING? Type OK to confirm — there is no undo.',
              )
            ) {
              startTransition(async () => {
                await clearAction();
                setArmed(false);
              });
            }
          }}
        >
          {isPending ? 'Clearing…' : 'Yes, delete everything'}
        </button>
        <button className="ghost" onClick={() => setArmed(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
