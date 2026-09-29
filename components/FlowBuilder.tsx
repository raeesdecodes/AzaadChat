'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  TriggerNode,
  MessageNode,
  PrivateReplyNode,
  ConditionNode,
} from './flow-nodes';
import type {
  Flow,
  FlowNode,
  FlowEdge,
  FlowNodeType,
} from '@/lib/flows';
import { nodeTypeLabel } from '@/lib/flows';
import { saveFlowCanvasAction, toggleFlowAction } from '@/app/flows/actions';
import {
  channelLabel,
  type MatchType,
  type TriggerChannel,
} from '@/lib/triggers';

// ---------------------------------------------------------------------------
// xyflow <-> Flow model conversion
// ---------------------------------------------------------------------------

function toXyNodes(nodes: FlowNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n.data },
  }));
}

function toXyEdges(edges: FlowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  }));
}

function fromXy(nodes: Node[], edges: Edge[]): {
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.type as FlowNodeType) ?? 'send_message',
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: Object.fromEntries(
        Object.entries((n.data ?? {}) as Record<string, unknown>).map(
          ([k, v]) => [k, String(v ?? '')],
        ),
      ),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}

const MATCH_TYPES: MatchType[] = ['exact', 'contains', 'starts_with'];
const CHANNELS: TriggerChannel[] = [
  'any',
  'instagram_dm',
  'instagram_comment',
  'facebook_message',
  'facebook_comment',
];

const PALETTE: { type: FlowNodeType; hint: string }[] = [
  { type: 'trigger', hint: 'Keyword that starts the flow' },
  { type: 'send_message', hint: 'Reply with text' },
  { type: 'private_reply', hint: 'Comment → DM' },
  { type: 'condition', hint: 'Branch on keyword' },
];

function defaultData(type: FlowNodeType): Record<string, string> {
  switch (type) {
    case 'trigger':
      return { keyword: 'LINK', matchType: 'contains', channel: 'any' };
    case 'send_message':
      return { text: '' };
    case 'private_reply':
      return { text: '' };
    case 'condition':
      return { keyword: '' };
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function Builder({ initialFlow }: { initialFlow: Flow }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toXyNodes(initialFlow.nodes),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toXyEdges(initialFlow.edges),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialFlow.enabled);
  const idCounter = useRef(0);

  const nodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      send_message: MessageNode,
      private_reply: PrivateReplyNode,
      condition: ConditionNode,
    }),
    [],
  );

  const onConnect = (conn: Connection) =>
    setEdges((eds) => addEdge({ ...conn, id: `e-${Date.now()}` }, eds));

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const addNode = (type: FlowNodeType) => {
    idCounter.current += 1;
    const id = `n-${Date.now()}-${idCounter.current}`;
    const offset = (idCounter.current % 6) * 40;
    setNodes((nds) =>
      nds.concat({
        id,
        type,
        position: { x: 120 + offset, y: 120 + offset },
        data: defaultData(type),
      }),
    );
    setSelectedId(id);
    setSaveState('idle');
  };

  const updateData = (field: string, value: string) => {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedId ? { ...n, data: { ...n.data, [field]: value } } : n,
      ),
    );
    setSaveState('idle');
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedId && e.target !== selectedId),
    );
    setSelectedId(null);
    setSaveState('idle');
  };

  const save = () => {
    setSaveError(null);
    startTransition(async () => {
      try {
        const { nodes: n, edges: e } = fromXy(nodes, edges);
        await saveFlowCanvasAction(
          initialFlow.id,
          JSON.stringify(n),
          JSON.stringify(e),
        );
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        setSaveError((err as Error).message);
      }
    });
  };

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await toggleFlowAction(initialFlow.id, next);
    });
  };

  const selectedData = (selected?.data ?? {}) as Record<string, unknown>;
  const sdata: Record<string, string> = Object.fromEntries(
    Object.entries(selectedData).map(([k, v]) => [k, String(v ?? '')]),
  );

  return (
    <div className="flow-page">
      <div className="flow-toolbar">
        <Link href="/flows" className="btn ghost small">
          ← Flows
        </Link>
        <h1>{initialFlow.name}</h1>
        <button
          className="ghost small"
          onClick={toggle}
          title={enabled ? 'Pause flow' : 'Activate flow'}
        >
          {enabled ? '● Active' : '○ Paused'}
        </button>
        <button onClick={save} disabled={isPending}>
          {isPending ? 'Saving…' : '💾 Save flow'}
        </button>
      </div>

      {saveState === 'saved' && (
        <div className="info" style={{ marginBottom: '0.9rem', marginTop: 0 }}>
          Flow saved. It will run the next time a matching message arrives.
        </div>
      )}
      {saveState === 'error' && saveError && (
        <div className="warn" style={{ marginBottom: '0.9rem', marginTop: 0 }}>
          Could not save: {saveError}
        </div>
      )}

      <div className="flow-workspace">
        <div className="flow-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(c) => {
              onNodesChange(c);
              setSaveState('idle');
            }}
            onEdgesChange={(c) => {
              onEdgesChange(c);
              setSaveState('idle');
            }}
            onConnect={onConnect}
            onSelectionChange={({ nodes: sel }) =>
              setSelectedId(sel[0]?.id ?? null)
            }
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.4}
            maxZoom={1.75}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <aside className="flow-side">
          <h3>Add node</h3>
          <div className="palette">
            {PALETTE.map((p) => (
              <button
                key={p.type}
                className="ghost"
                onClick={() => addNode(p.type)}
                title={p.hint}
              >
                + {nodeTypeLabel(p.type)}
              </button>
            ))}
          </div>

          <h3>Properties</h3>
          {!selected ? (
            <p className="muted small">
              Click a node to edit it. Drag between handles to connect nodes.
              The flow runs top-down from the Trigger; a Condition branches on
              its <strong>true</strong> / <strong>false</strong> handles.
            </p>
          ) : (
            <div className="node-props">
              <p className="muted small" style={{ marginTop: 0 }}>
                Editing: <strong>{nodeTypeLabel(selected.type as FlowNodeType)}</strong>
              </p>

              {selected.type === 'trigger' && (
                <>
                  <label className="field">
                    <span>Keyword</span>
                    <input
                      type="text"
                      value={sdata.keyword ?? ''}
                      onChange={(e) => updateData('keyword', e.target.value)}
                      placeholder="e.g. LINK"
                    />
                  </label>
                  <label className="field">
                    <span>Match type</span>
                    <select
                      value={sdata.matchType ?? 'contains'}
                      onChange={(e) => updateData('matchType', e.target.value)}
                    >
                      {MATCH_TYPES.map((m) => (
                        <option key={m} value={m}>
                          {m.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Channel</span>
                    <select
                      value={sdata.channel ?? 'any'}
                      onChange={(e) => updateData('channel', e.target.value)}
                    >
                      {CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {channelLabel(c)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {(selected.type === 'send_message' ||
                selected.type === 'private_reply') && (
                <label className="field">
                  <span>
                    {selected.type === 'private_reply'
                      ? 'DM text (sent to the commenter)'
                      : 'Message text'}
                  </span>
                  <textarea
                    value={sdata.text ?? ''}
                    onChange={(e) => updateData('text', e.target.value)}
                    rows={4}
                    placeholder="Write the message…"
                  />
                </label>
              )}

              {selected.type === 'condition' && (
                <label className="field">
                  <span>Keyword (message must contain)</span>
                  <input
                    type="text"
                    value={sdata.keyword ?? ''}
                    onChange={(e) => updateData('keyword', e.target.value)}
                    placeholder="e.g. price"
                  />
                </label>
              )}

              <button className="danger small" onClick={deleteSelected}>
                Delete node
              </button>
            </div>
          )}

          <div className="info small" style={{ marginTop: '1.2rem' }}>
            <strong>Tip:</strong> a classic comment-to-DM flow is{' '}
            <strong>Trigger “LINK”</strong> → <strong>Private reply</strong>.
            Connect the trigger&apos;s handle to the next node.
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function FlowBuilder({ initialFlow }: { initialFlow: Flow }) {
  return (
    <ReactFlowProvider>
      <Builder initialFlow={initialFlow} />
    </ReactFlowProvider>
  );
}
