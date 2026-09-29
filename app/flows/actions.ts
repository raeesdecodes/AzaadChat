'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/store';
import type { FlowNode, FlowEdge, FlowNodeType } from '@/lib/flows';

const NODE_TYPES: FlowNodeType[] = [
  'trigger',
  'send_message',
  'private_reply',
  'condition',
];

export async function createFlowAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim() || 'Untitled flow';
  const flow = await getStore().createFlow(name.slice(0, 80));
  revalidatePath('/flows');
  redirect(`/flows/${flow.id}`);
}

export async function renameFlowAction(
  id: string,
  formData: FormData,
): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Name is required.');
  await getStore().updateFlow(id, { name: name.slice(0, 80) });
  revalidatePath('/flows');
  revalidatePath(`/flows/${id}`);
}

export async function toggleFlowAction(
  id: string,
  enabled: boolean,
): Promise<void> {
  await getStore().updateFlow(id, { enabled });
  revalidatePath('/flows');
  revalidatePath(`/flows/${id}`);
}

export async function duplicateFlowAction(id: string): Promise<void> {
  const copy = await getStore().duplicateFlow(id);
  revalidatePath('/flows');
  redirect(`/flows/${copy.id}`);
}

export async function deleteFlowAction(id: string): Promise<void> {
  await getStore().deleteFlow(id);
  revalidatePath('/flows');
  redirect('/flows');
}

/** Persist the canvas (nodes + edges) from the flow builder. */
export async function saveFlowCanvasAction(
  id: string,
  nodesJson: string,
  edgesJson: string,
): Promise<void> {
  let nodes: FlowNode[];
  let edges: FlowEdge[];
  try {
    nodes = JSON.parse(nodesJson) as FlowNode[];
    edges = JSON.parse(edgesJson) as FlowEdge[];
  } catch {
    throw new Error('Invalid canvas data.');
  }
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new Error('Invalid canvas data.');
  }

  const cleanNodes: FlowNode[] = nodes
    .filter(
      (n) =>
        n &&
        typeof n.id === 'string' &&
        NODE_TYPES.includes(n.type as FlowNodeType),
    )
    .map((n) => ({
      id: n.id,
      type: n.type as FlowNodeType,
      position: {
        x: Number(n.position?.x) || 0,
        y: Number(n.position?.y) || 0,
      },
      data: Object.fromEntries(
        Object.entries((n.data ?? {}) as Record<string, unknown>).map(
          ([k, v]) => [k, String(v ?? '')],
        ),
      ),
    }));

  const nodeIds = new Set(cleanNodes.map((n) => n.id));
  const cleanEdges: FlowEdge[] = edges
    .filter(
      (e) => e && typeof e.id === 'string' && nodeIds.has(e.source) && nodeIds.has(e.target),
    )
    .map((e) => ({
      id: String(e.id),
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    }));

  if (!cleanNodes.some((n) => n.type === 'trigger')) {
    throw new Error('A flow needs at least one Trigger node.');
  }

  await getStore().updateFlow(id, { nodes: cleanNodes, edges: cleanEdges });
  revalidatePath('/flows');
  revalidatePath(`/flows/${id}`);
}
