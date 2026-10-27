import type { AskPayload, ComponentType, GoalUpdatedPayload, MessagePayload, StatusPayload } from '../lib/protocol';
import type { IncomingEvent } from '../lib/transport';
import { formatCurrency } from '../lib/utils/format';
import { executionStateOf } from './reducer';

export type GoalStatus = GoalUpdatedPayload['status'];

export interface GoalView {
  goalId: string;
  threadId?: string;
  title: string;
  status: GoalStatus;
  progressPercent?: number;
  milestones?: { completed: number; total: number };
  metrics?: {
    spend: number;
    budget?: number;
    currency: string;
    impressions?: number;
    clicks?: number;
    conversions?: number;
  };
  updatedAt: string;
}

export interface LocalMessage {
  clientMsgId: string;
  threadId?: string;
  text: string;
  sentAt: string;
  status: 'sending' | 'sent' | 'failed';
}

export type AskDecision = {
  state: 'submitting' | 'submitted';
  choice: 'approve' | 'reject' | 'edit';
};

export type ThreadItem =
  | { kind: 'event'; key: string; at: string; event: IncomingEvent }
  | { kind: 'local'; key: string; at: string; message: LocalMessage };

const REPORT_COMPONENTS: ComponentType[] = ['metric_chart', 'table', 'spend_bar', 'metric_tile'];

interface GoalSummaryUIProps {
  title?: string;
  progress?: number;
  metrics?: { spend?: number; budget?: number; currency?: string; impressions?: number; clicks?: number; conversions?: number };
}

export function selectGoals(events: IncomingEvent[]): GoalView[] {
  const goals = new Map<string, GoalView>();
  for (const event of events) {
    if (event.type !== 'goal_updated') continue;
    const payload = event.payload as unknown as GoalUpdatedPayload;
    if (!payload.goalId) continue;
    const ui = (event.ui?.props ?? {}) as GoalSummaryUIProps;
    const previous = goals.get(payload.goalId);
    const progress = payload.progress;
    const percent =
      typeof ui.progress === 'number'
        ? ui.progress
        : progress && progress.total > 0
          ? Math.round((progress.completed / progress.total) * 100)
          : previous?.progressPercent;

    const metricsSource = ui.metrics ?? payload.metrics;
    goals.set(payload.goalId, {
      goalId: payload.goalId,
      threadId: event.threadId ?? previous?.threadId,
      title: ui.title || previous?.title || event.fallbackText || 'Untitled goal',
      status: payload.status ?? previous?.status ?? 'active',
      progressPercent: percent,
      milestones: progress ? { completed: progress.completed, total: progress.total } : previous?.milestones,
      metrics: metricsSource
        ? {
            spend: metricsSource.spend ?? 0,
            budget: ui.metrics?.budget ?? previous?.metrics?.budget,
            currency: ui.metrics?.currency ?? previous?.metrics?.currency ?? 'USD',
            impressions: metricsSource.impressions,
            clicks: metricsSource.clicks,
            conversions: metricsSource.conversions,
          }
        : previous?.metrics,
      updatedAt: event.at,
    });
  }
  const order: Record<GoalStatus, number> = { active: 0, paused: 1, completed: 2, cancelled: 3 };
  return Array.from(goals.values()).sort(
    (a, b) => order[a.status] - order[b.status] || b.updatedAt.localeCompare(a.updatedAt)
  );
}

/**
 * proba-hub sends brain replies with both payload.text and a `text` UI whose
 * props.text is the same string; rendering both shows the message twice.
 */
export function messageUI(event: IncomingEvent): IncomingEvent['ui'] | undefined {
  if (!event.ui) return undefined;
  const text = (event.payload as { text?: unknown }).text;
  const props = event.ui.props as { text?: unknown } | undefined;
  if (event.ui.component === 'text' && typeof text === 'string' && props?.text === text) return undefined;
  return event.ui;
}

export function askPayload(event: IncomingEvent): AskPayload | null {
  if (event.type !== 'ask') return null;
  const payload = event.payload as unknown as AskPayload;
  return payload.askId ? payload : null;
}

const finiteNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/**
 * What an approval card should show for a spend decision. The Hub stores the real current and proposed
 * amounts on the ask (costEffect) and the goal's own budget on goal_updated; the card's own
 * currentValue / proposedValue are display text the brain supplies, and the protocol's tool-call mapper
 * fills both with the same parameters JSON. So for an action approval that carries a cost, current and
 * proposed come from the ask (the goal's budget when the ask has no current amount) and replace display
 * text that is missing or identical on both sides. Anything else renders exactly as sent.
 */
export function approvalUI(event: IncomingEvent, goals: GoalView[]): IncomingEvent['ui'] | undefined {
  const ask = askPayload(event);
  if (!ask || ask.askType !== 'action_approval') return event.ui;
  if (event.ui && event.ui.component !== 'approval_card') return event.ui;

  const proposed = finiteNumber(ask.costEffect?.proposed);
  if (proposed === undefined) return event.ui;
  const goal = event.threadId ? goals.find((g) => g.threadId === event.threadId) : undefined;
  const current = finiteNumber(ask.costEffect?.current) ?? (goal?.metrics?.budget ? goal.metrics.budget : undefined);
  if (current === undefined) return event.ui;
  const currency = ask.costEffect?.currency || goal?.metrics?.currency || 'USD';

  const base = (event.ui?.props ?? { title: ask.title, description: ask.description, risk: ask.risk }) as {
    currentValue?: string;
    proposedValue?: string;
  };
  const needsValues = !base.currentValue || !base.proposedValue || base.currentValue === base.proposedValue;
  return {
    component: 'approval_card',
    version: event.ui?.version ?? '1.0.0',
    props: {
      ...base,
      ...(needsValues ? { currentValue: formatCurrency(current, currency), proposedValue: formatCurrency(proposed, currency) } : {}),
      costImpact: { current, proposed, currency },
    },
    ...(event.ui?.actions ? { actions: event.ui.actions } : {}),
  } as IncomingEvent['ui'];
}

export function selectResolvedAskIds(events: IncomingEvent[]): Set<string> {
  const resolved = new Set<string>();
  for (const event of events) {
    if (event.type === 'ask_resolved') {
      const askId = (event.payload as { askId?: string }).askId;
      if (askId) resolved.add(askId);
    }
  }
  return resolved;
}

export function selectOpenAsks(events: IncomingEvent[], decisions: Record<string, AskDecision>): IncomingEvent[] {
  const resolved = selectResolvedAskIds(events);
  return events.filter((event) => {
    const ask = askPayload(event);
    if (!ask) return false;
    return !resolved.has(ask.askId) && decisions[ask.askId]?.state !== 'submitted';
  });
}

export function selectThreadItems(
  events: IncomingEvent[],
  localMessages: LocalMessage[],
  threadId: string | undefined
): ThreadItem[] {
  const items: ThreadItem[] = [];
  for (const event of events) {
    if (event.type === 'ack' || event.type === 'goal_updated' || event.type === 'ask_resolved' || event.type === 'status') continue;
    if (threadId && event.threadId !== threadId) continue;
    if (event.ui && REPORT_COMPONENTS.includes(event.ui.component) && event.type === 'message') continue;
    items.push({ kind: 'event', key: `e-${event.seq}`, at: event.at, event });
  }
  for (const message of localMessages) {
    if (threadId && message.threadId !== threadId) continue;
    items.push({ kind: 'local', key: `l-${message.clientMsgId}`, at: message.sentAt, message });
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

export function selectReports(events: IncomingEvent[], threadId: string | undefined): IncomingEvent[] {
  return events.filter(
    (event) =>
      event.ui && REPORT_COMPONENTS.includes(event.ui.component) && (!threadId || event.threadId === threadId)
  );
}

export function selectLatestStatus(events: IncomingEvent[], threadId?: string): StatusPayload | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === 'status' && (!threadId || event.threadId === threadId)) {
      return event.payload as unknown as StatusPayload;
    }
  }
  return null;
}

export type ActivityCategory = 'decision' | 'question' | 'update' | 'alert' | 'message' | 'goal';

export interface ActivityEntry {
  key: string;
  at: string;
  threadId?: string;
  title: string;
  detail?: string;
  category: ActivityCategory;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

export function describeEvent(event: IncomingEvent): ActivityEntry | null {
  const base = { key: `a-${event.seq}`, at: event.at, threadId: event.threadId };
  switch (event.type) {
    case 'ask': {
      const ask = askPayload(event);
      if (!ask) return null;
      const isQuestion = ask.askType === 'clarify';
      return {
        ...base,
        title: isQuestion ? 'Proba asked a question' : ask.askType === 'plan_approval' ? 'Plan submitted for approval' : 'Approval requested',
        detail: ask.title,
        category: isQuestion ? 'question' : 'decision',
        tone: isQuestion ? 'info' : 'warning',
      };
    }
    case 'ask_resolved': {
      const payload = event.payload as { answer?: { choice?: string }; resolution?: string };
      const choice = payload.answer?.choice;
      return {
        ...base,
        title:
          payload.resolution === 'expired'
            ? 'Request expired'
            : choice === 'reject'
              ? 'Request declined'
              : choice === 'approve'
                ? 'Request approved'
                : 'Request answered',
        detail: event.fallbackText,
        category: 'decision',
        tone: choice === 'reject' || payload.resolution === 'expired' ? 'neutral' : 'success',
      };
    }
    case 'status': {
      const payload = event.payload as unknown as StatusPayload;
      const executionState = executionStateOf(event);
      if (executionState) {
        const title = { running: 'Activity resumed', paused: 'All activity paused', stopped: 'Emergency stop engaged' }[executionState];
        return { ...base, title, category: 'update', tone: executionState === 'stopped' ? 'danger' : executionState === 'paused' ? 'warning' : 'success' };
      }
      return {
        ...base,
        title: payload.message || event.fallbackText || 'Status updated',
        category: 'update',
        tone: payload.state === 'error' ? 'danger' : 'info',
      };
    }
    case 'alert': {
      const payload = event.payload as { title?: string; message?: string; severity?: string };
      return {
        ...base,
        title: payload.title || 'Alert',
        detail: payload.message,
        category: 'alert',
        tone: payload.severity === 'error' ? 'danger' : payload.severity === 'success' ? 'success' : 'warning',
      };
    }
    case 'error': {
      const payload = event.payload as { message?: string };
      return { ...base, title: 'Something went wrong', detail: payload.message, category: 'alert', tone: 'danger' };
    }
    case 'goal_updated': {
      return {
        ...base,
        title: 'Goal updated',
        detail: event.fallbackText,
        category: 'goal',
        tone: 'neutral',
      };
    }
    case 'message': {
      const payload = event.payload as unknown as Partial<MessagePayload>;
      const text = payload.text || event.fallbackText;
      if (!text) return null;
      return {
        ...base,
        title: payload.source === 'user' ? 'You sent a message' : 'Proba posted an update',
        detail: text,
        category: 'message',
        tone: 'neutral',
      };
    }
    default:
      return null;
  }
}

export function selectActivity(events: IncomingEvent[]): ActivityEntry[] {
  return events
    .map(describeEvent)
    .filter((entry): entry is ActivityEntry => entry !== null)
    .sort((a, b) => b.at.localeCompare(a.at));
}
