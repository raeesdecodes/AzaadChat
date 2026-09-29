'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { channelLabel, type TriggerChannel } from '@/lib/triggers';

type Data = Record<string, string>;

function dataOf(data: NodeProps['data']): Data {
  const out: Data = {};
  for (const [k, v] of Object.entries(data ?? {})) out[k] = String(v ?? '');
  return out;
}

export function TriggerNode({ data, selected }: NodeProps) {
  const d = dataOf(data);
  return (
    <div className={`cz-node node-trigger ${selected ? 'selected' : ''}`}>
      <Handle type="source" position={Position.Right} />
      <div className="node-title">⚡ Trigger</div>
      <div className="node-line">
        <strong>“{d.keyword || '…'}”</strong>
      </div>
      <div className="node-line">
        {d.matchType?.replace('_', ' ') || 'contains'} ·{' '}
        {channelLabel((d.channel as TriggerChannel) || 'any')}
      </div>
    </div>
  );
}

export function MessageNode({ data, selected }: NodeProps) {
  const d = dataOf(data);
  return (
    <div className={`cz-node node-send_message ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="node-title">💬 Send message</div>
      <div className="node-line">{d.text ? d.text.slice(0, 60) : <em>empty — click to edit</em>}</div>
    </div>
  );
}

export function PrivateReplyNode({ data, selected }: NodeProps) {
  const d = dataOf(data);
  return (
    <div className={`cz-node node-private_reply ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="node-title">✉️ Private reply</div>
      <div className="node-line">comment → DM</div>
      <div className="node-line">{d.text ? d.text.slice(0, 60) : <em>empty — click to edit</em>}</div>
    </div>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = dataOf(data);
  return (
    <div className={`cz-node node-condition ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-title">🔀 Condition</div>
      <div className="node-line">
        text contains <strong>“{d.keyword || '…'}”</strong>
      </div>
      <div className="node-line" style={{ marginTop: '0.25rem' }}>
        <span style={{ color: 'var(--ok)' }}>● true</span>
        {'  '}
        <span style={{ color: 'var(--danger)' }}>● false</span>
      </div>
      <Handle type="source" position={Position.Right} id="true" style={{ top: 34 }} />
      <Handle type="source" position={Position.Right} id="false" style={{ top: 66 }} />
    </div>
  );
}
