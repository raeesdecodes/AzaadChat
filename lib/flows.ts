/**
 * Visual flow engine for ChatAzad.
 *
 * A Flow is a small directed graph of nodes:
 *  - trigger:       entry point — keyword + match type + channel
 *  - send_message:  send text (DM thread, or a public comment reply)
 *  - private_reply: comment → DM (the classic ManyChat flow)
 *  - condition:     keyword-contains branch with true/false handles
 *
 * Execution walks the graph sequentially from the matching trigger node,
 * following single outgoing edges. Condition nodes branch on a keyword
 * "contains" check. A step cap prevents infinite loops. Errors are logged
 * via the onLog callback / console — never thrown past the caller.
 */
import {
  matches,
  normalize,
  type MatchType,
  type TriggerChannel,
  type Trigger,
} from './triggers';

export type FlowNodeType =
  | 'trigger'
  | 'send_message'
  | 'private_reply'
  | 'condition';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: Record<string, string>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface Flow {
  id: string;
  name: string;
  enabled: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface FlowEventContext {
  channel: TriggerChannel;
  text: string;
  senderId?: string;
  commentId?: string;
}

export interface FlowSendDeps {
  sendDM: (recipientId: string, text: string) => Promise<unknown>;
  sendCommentReply: (commentId: string, text: string) => Promise<unknown>;
  sendPrivateReply: (commentId: string, text: string) => Promise<unknown>;
}

const MAX_STEPS = 25;

function asTrigger(node: FlowNode): Trigger {
  return {
    id: node.id,
    keyword: node.data.keyword ?? '',
    matchType: (node.data.matchType as MatchType) || 'contains',
    channel: (node.data.channel as TriggerChannel) || 'any',
    replyText: '',
    action: 'send_text',
    enabled: true,
    createdAt: '',
  };
}

/** Find the first enabled flow with a trigger node matching the event. */
export function findMatchingFlow(
  flows: Flow[],
  channel: TriggerChannel,
  text: string,
): { flow: Flow; triggerNode: FlowNode } | undefined {
  for (const flow of flows) {
    if (!flow.enabled) continue;
    for (const node of flow.nodes) {
      if (node.type !== 'trigger') continue;
      if (matches(asTrigger(node), channel, text)) {
        console.log(
          `[flows] MATCH flow="${flow.name}" keyword="${node.data.keyword}" on ${channel}`,
        );
        return { flow, triggerNode: node };
      }
    }
  }
  return undefined;
}

function nextNodeId(
  edges: FlowEdge[],
  fromId: string,
  handle?: string | null,
): string | undefined {
  const edge = edges.find(
    (e) =>
      e.source === fromId &&
      (handle == null ? e.sourceHandle == null : e.sourceHandle === handle),
  );
  return edge?.target;
}

/**
 * Walk the flow graph from the trigger node, executing nodes in order.
 * Returns the number of send actions executed.
 */
export async function executeFlow(
  flow: Flow,
  triggerNode: FlowNode,
  ev: FlowEventContext,
  deps: FlowSendDeps,
  onLog?: (msg: string) => void,
): Promise<number> {
  const log =
    onLog ?? ((m: string) => console.log(`[flows:${flow.name}] ${m}`));
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
  let currentId: string | undefined = triggerNode.id;
  let actions = 0;

  for (let step = 0; step < MAX_STEPS && currentId; step++) {
    const node = nodeById.get(currentId);
    if (!node) {
      log(`edge points to missing node "${currentId}" — stopping`);
      break;
    }

    switch (node.type) {
      case 'trigger':
        currentId = nextNodeId(flow.edges, node.id);
        break;

      case 'send_message': {
        const text = (node.data.text ?? '').trim();
        if (!text) {
          log('send_message node has empty text — skipped');
        } else if (
          ev.channel === 'instagram_dm' ||
          ev.channel === 'facebook_message'
        ) {
          if (!ev.senderId) {
            log('send_message: no senderId — skipped');
            break;
          }
          await deps.sendDM(ev.senderId, text);
          actions++;
          log(`sent DM to ${ev.senderId}`);
        } else {
          if (!ev.commentId) {
            log('send_message: no commentId — skipped');
            break;
          }
          await deps.sendCommentReply(ev.commentId, text);
          actions++;
          log(`public reply to comment ${ev.commentId}`);
        }
        currentId = nextNodeId(flow.edges, node.id);
        break;
      }

      case 'private_reply': {
        const text = (node.data.text ?? '').trim();
        if (!text) {
          log('private_reply node has empty text — skipped');
        } else if (
          ev.commentId &&
          (ev.channel === 'instagram_comment' ||
            ev.channel === 'facebook_comment')
        ) {
          await deps.sendPrivateReply(ev.commentId, text);
          actions++;
          log(`private reply sent for comment ${ev.commentId}`);
        } else if (ev.senderId) {
          // Triggered from a DM thread — a private reply makes no sense,
          // so fall back to a normal DM send.
          await deps.sendDM(ev.senderId, text);
          actions++;
          log(`private_reply on DM channel — sent as DM to ${ev.senderId}`);
        } else {
          log('private_reply: no commentId or senderId — skipped');
        }
        currentId = nextNodeId(flow.edges, node.id);
        break;
      }

      case 'condition': {
        const keyword = normalize(node.data.keyword ?? '');
        const hit = keyword !== '' && normalize(ev.text).includes(keyword);
        log(`condition "${node.data.keyword ?? ''}" → ${hit ? 'TRUE' : 'FALSE'}`);
        currentId = nextNodeId(flow.edges, node.id, hit ? 'true' : 'false');
        break;
      }

      default:
        log(`unknown node type "${(node as FlowNode).type}" — stopping`);
        currentId = undefined;
    }
  }

  return actions;
}

export function nodeTypeLabel(type: FlowNodeType): string {
  switch (type) {
    case 'trigger':
      return 'Trigger';
    case 'send_message':
      return 'Send message';
    case 'private_reply':
      return 'Private reply';
    case 'condition':
      return 'Condition';
  }
}

/** Starter canvas for a brand-new flow. */
export function defaultNodes(): FlowNode[] {
  return [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 80, y: 180 },
      data: { keyword: 'LINK', matchType: 'contains', channel: 'any' },
    },
  ];
}
