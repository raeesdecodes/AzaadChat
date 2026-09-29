'use client';

import { useState } from 'react';

interface Props {
  flowId: string;
  flowName: string;
  enabled: boolean;
  renameAction: (id: string, formData: FormData) => Promise<void>;
  toggleAction: (id: string, enabled: boolean) => Promise<void>;
  duplicateAction: (id: string) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}

export default function FlowRowActions({
  flowId,
  flowName,
  enabled,
  renameAction,
  toggleAction,
  duplicateAction,
  deleteAction,
}: Props) {
  const [renaming, setRenaming] = useState(false);

  return (
    <>
      {renaming ? (
        <form
          action={async (fd) => {
            await renameAction(flowId, fd);
            setRenaming(false);
          }}
          style={{ display: 'flex', gap: '0.4rem' }}
        >
          <input
            type="text"
            name="name"
            defaultValue={flowName}
            maxLength={80}
            required
            style={{ maxWidth: 180 }}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <button type="submit" className="small">
            Save
          </button>
          <button
            type="button"
            className="ghost small"
            onClick={() => setRenaming(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <button
            className="ghost small"
            onClick={() => toggleAction(flowId, !enabled)}
            title={enabled ? 'Pause flow' : 'Activate flow'}
          >
            {enabled ? 'Pause' : 'Activate'}
          </button>
          <button className="ghost small" onClick={() => setRenaming(true)}>
            Rename
          </button>
          <button className="ghost small" onClick={() => duplicateAction(flowId)}>
            Duplicate
          </button>
          <button
            className="danger small"
            onClick={() => {
              if (confirm(`Delete flow "${flowName}"? This cannot be undone.`)) {
                deleteAction(flowId);
              }
            }}
          >
            Delete
          </button>
        </>
      )}
    </>
  );
}
