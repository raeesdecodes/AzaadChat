/**
 * Keyword trigger engine.
 *
 * A Trigger watches one channel (or all channels) for a keyword and, on the
 * first match, fires its action. Triggers are evaluated in array order —
 * first match wins.
 */

export type MatchType = 'exact' | 'contains' | 'starts_with';

export type TriggerChannel =
  | 'instagram_dm'
  | 'instagram_comment'
  | 'facebook_message'
  | 'facebook_comment'
  | 'any';

export type TriggerAction =
  | 'send_text' // reply in the same thread (DM -> DM, comment -> public reply)
  | 'private_reply'; // comment -> DM ("private reply", the classic ManyChat flow)

export interface Trigger {
  id: string;
  keyword: string;
  matchType: MatchType;
  channel: TriggerChannel;
  replyText: string;
  action: TriggerAction;
  enabled: boolean;
  createdAt: string;
}

export function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/** True when the trigger fires for the given channel + incoming text. */
export function matches(
  trigger: Trigger,
  channel: TriggerChannel,
  text: string,
): boolean {
  if (!trigger.enabled) return false;
  if (trigger.channel !== 'any' && trigger.channel !== channel) return false;
  const incoming = normalize(text);
  const keyword = normalize(trigger.keyword);
  if (!keyword || !incoming) return false;

  switch (trigger.matchType) {
    case 'exact':
      return incoming === keyword;
    case 'starts_with':
      return incoming.startsWith(keyword);
    case 'contains':
      return incoming.includes(keyword);
    default:
      return false;
  }
}

/**
 * Find the first trigger that matches. Returns undefined when nothing fires.
 * Matching is case-insensitive and first-match wins.
 */
export function findMatchingTrigger(
  triggers: Trigger[],
  channel: TriggerChannel,
  text: string,
): Trigger | undefined {
  for (const trigger of triggers) {
    if (matches(trigger, channel, text)) {
      console.log(
        `[triggers] MATCH keyword="${trigger.keyword}" (${trigger.matchType}) on ${channel} -> action=${trigger.action}`,
      );
      return trigger;
    }
  }
  console.log(`[triggers] no match on ${channel} for: "${text.slice(0, 80)}"`);
  return undefined;
}

/** Human-friendly label for the dashboard. */
export function channelLabel(channel: TriggerChannel): string {
  switch (channel) {
    case 'instagram_dm':
      return 'Instagram DM';
    case 'instagram_comment':
      return 'Instagram comment';
    case 'facebook_message':
      return 'Facebook message';
    case 'facebook_comment':
      return 'Facebook comment';
    case 'any':
      return 'Any channel';
    default:
      return channel;
  }
}

export function actionLabel(action: TriggerAction): string {
  return action === 'private_reply' ? 'Private reply (comment → DM)' : 'Send text reply';
}
