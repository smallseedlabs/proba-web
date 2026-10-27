import { describe, it, expect } from 'vitest';
import type { IncomingEvent } from '../lib/transport';
import { approvalUI, describeEvent, messageUI, selectActivity, selectGoals, selectOpenAsks, selectReports, selectThreadItems } from './selectors';
import { initialWorkspaceState, workspaceReducer } from './reducer';

let seq = 0;
const ev = (e: Partial<IncomingEvent> & Pick<IncomingEvent, 'type'>): IncomingEvent => ({
  kind: 'event',
  seq: ++seq,
  at: new Date(Date.UTC(2026, 9, 1, 10, seq)).toISOString(),
  payload: {},
  ...e,
});

describe('selectors', () => {
  it('keeps the latest state per goal and sorts active goals first', () => {
    const events = [
      ev({ type: 'goal_updated', threadId: 't1', payload: { goalId: 'g1', status: 'completed' }, ui: { component: 'goal_summary', version: '1', props: { title: 'Old goal', progress: 100 } } }),
      ev({ type: 'goal_updated', threadId: 't2', payload: { goalId: 'g2', status: 'active', progress: { completed: 1, total: 4 } }, ui: { component: 'goal_summary', version: '1', props: { title: 'Draft goal' } } }),
      ev({ type: 'goal_updated', threadId: 't2', payload: { goalId: 'g2', status: 'active', progress: { completed: 2, total: 4 } }, ui: { component: 'goal_summary', version: '1', props: { title: 'New goal' } } }),
      ev({ type: 'goal_updated', threadId: 't3', payload: { goalId: 'g3', status: 'paused' } }),
    ];
    const goals = selectGoals(events);
    expect(goals.map((g) => g.goalId)).toEqual(['g2', 'g3', 'g1']);
    expect(goals[0].progressPercent).toBe(50);
    expect(goals[0].title).toBe('New goal');
    expect(goals[1].title).toBe('Untitled goal');
    expect(goals[2].title).toBe('Old goal');
  });

  it('treats asks as open until resolved by the server or answered locally', () => {
    const a1 = ev({ type: 'ask', payload: { askId: 'a1', askType: 'clarify', title: 'Q' } });
    const a2 = ev({ type: 'ask', payload: { askId: 'a2', askType: 'action_approval', title: 'Budget' } });
    const a3 = ev({ type: 'ask', payload: { askId: 'a3', askType: 'plan_approval', title: 'Plan' } });
    const resolved = ev({ type: 'ask_resolved', payload: { askId: 'a1', resolution: 'answered' } });
    const open = selectOpenAsks([a1, a2, a3, resolved], { a2: { state: 'submitted', choice: 'approve' } });
    expect(open).toEqual([a3]);
  });

  it('builds a chronological thread without acknowledgements or report widgets', () => {
    const msg = ev({ type: 'message', threadId: 't1', payload: { text: 'Hi', source: 'brain' } });
    const ack = ev({ type: 'ack', threadId: 't1', payload: { clientMsgId: 'c1' } });
    const chart = ev({ type: 'message', threadId: 't1', ui: { component: 'metric_chart', version: '1', props: {} } });
    const other = ev({ type: 'message', threadId: 't2', payload: { text: 'Elsewhere' } });
    const items = selectThreadItems([msg, ack, chart, other], [{ clientMsgId: 'c1', threadId: 't1', text: 'Hello', sentAt: '2026-12-01T00:00:00Z', status: 'sent' }], 't1');
    expect(items.map((i) => i.key)).toEqual([`e-${msg.seq}`, 'l-c1']);
    expect(selectReports([msg, chart, other], 't1')).toEqual([chart]);
  });

  it('describes events in business language for the activity log', () => {
    expect(describeEvent(ev({ type: 'ask', payload: { askId: 'x', askType: 'plan_approval', title: 'Launch plan' } }))?.title).toBe('Plan submitted for approval');
    expect(describeEvent(ev({ type: 'ask_resolved', payload: { askId: 'x', answer: { choice: 'reject' } } }))?.title).toBe('Request declined');
    expect(describeEvent(ev({ type: 'message', payload: { text: 'Update', source: 'brain' } }))?.title).toBe('Proba posted an update');
    expect(describeEvent(ev({ type: 'ack', payload: {} }))).toBeNull();
    const activity = selectActivity([ev({ type: 'status', payload: { state: 'executing', message: 'A' } }), ev({ type: 'status', payload: { state: 'error', message: 'B' } })]);
    expect(activity.map((a) => a.title)).toEqual(['B', 'A']);
    expect(activity[0].tone).toBe('danger');
  });
});

describe('workspaceReducer', () => {
  it('ignores duplicate events and marks the workspace loaded', () => {
    const e = ev({ type: 'message', payload: { text: 'x' } });
    let state = workspaceReducer(initialWorkspaceState, { type: 'event', event: e });
    state = workspaceReducer(state, { type: 'event', event: e });
    expect(state.events).toHaveLength(1);
    expect(state.hasLoaded).toBe(true);
  });

  it('marks local messages as sent when acknowledged', () => {
    let state = workspaceReducer(initialWorkspaceState, {
      type: 'local_message',
      message: { clientMsgId: 'c1', text: 'Hi', sentAt: '', status: 'sending' },
    });
    state = workspaceReducer(state, { type: 'event', event: ev({ type: 'ack', payload: { clientMsgId: 'c1' } }) });
    expect(state.localMessages[0].status).toBe('sent');
  });

  it('treats an open connection as loaded even with no events', () => {
    expect(workspaceReducer(initialWorkspaceState, { type: 'connection', status: 'open' }).hasLoaded).toBe(true);
    expect(workspaceReducer(initialWorkspaceState, { type: 'connection', status: 'reconnecting' }).hasLoaded).toBe(false);
  });
});

describe('messageUI', () => {
  const base = { kind: 'event' as const, seq: 1, type: 'message' as const, at: '2026-01-01T00:00:00Z' };

  it('drops a text UI that repeats payload.text', () => {
    const event = { ...base, payload: { text: 'Hi', source: 'brain' }, ui: { component: 'text' as const, version: '1.0.0', props: { text: 'Hi' } } };
    expect(messageUI(event)).toBeUndefined();
  });

  it('keeps other UI', () => {
    const ui = { component: 'metric_tile' as const, version: '1.0.0', props: { label: 'Spend', value: 1 } };
    expect(messageUI({ ...base, payload: { text: 'Hi', source: 'brain' }, ui })).toBe(ui);
    const different = { component: 'text' as const, version: '1.0.0', props: { text: 'Other' } };
    expect(messageUI({ ...base, payload: { text: 'Hi', source: 'brain' }, ui: different })).toBe(different);
  });
});

describe('approvalUI (budget decisions)', () => {
  const goals = selectGoals([
    ev({ type: 'goal_updated', threadId: 'tb', payload: { goalId: 'gb', status: 'active' }, ui: { component: 'goal_summary', version: '1', props: { title: 'Boot', metrics: { spend: 10, budget: 100, currency: 'EUR' } } } }),
  ]);
  const ask = (threadId: string | undefined, payload: Record<string, unknown>, ui?: IncomingEvent['ui']) =>
    ev({ type: 'ask', threadId, payload: { askId: 'a1', askType: 'action_approval', title: 'Adjust budget', blocking: true, risk: 'medium', questions: [], ...payload }, ui });
  const props = (ui: IncomingEvent['ui']) => ui?.props as Record<string, unknown>;

  it("replaces the protocol mapper's identical placeholder values with the ask's real current and proposed amounts", () => {
    const json = '{\n  "dailyBudget": 120\n}';
    const event = ask(
      'tb',
      { costEffect: { current: 100, proposed: 120, currency: 'USD', impact: '20.0%' } },
      { component: 'approval_card', version: '1.0.0', props: { title: 'Tool: adjust_budget', currentValue: json, proposedValue: json, risk: 'medium' } }
    );
    const ui = approvalUI(event, goals);
    expect(props(ui)).toMatchObject({
      title: 'Tool: adjust_budget',
      currentValue: '$100',
      proposedValue: '$120',
      costImpact: { current: 100, proposed: 120, currency: 'USD' },
    });
  });

  it('keeps display text that already differs, but takes the cost from the ask', () => {
    const event = ask(
      'tb',
      { costEffect: { current: 120, proposed: 145, currency: 'USD', impact: '+$25 per day' } },
      { component: 'approval_card', version: '1.0.0', props: { currentValue: '$40 / day', proposedValue: '$65 / day', costImpact: { current: 1, proposed: 2, currency: 'USD' } } }
    );
    expect(props(approvalUI(event, goals))).toMatchObject({ currentValue: '$40 / day', proposedValue: '$65 / day', costImpact: { current: 120, proposed: 145 } });
  });

  it("falls back to the goal's own budget as the current value when the ask has none, in the goal's currency", () => {
    const event = ask('tb', { costEffect: { proposed: 150, currency: '' } });
    const ui = approvalUI(event, goals);
    expect(ui?.component).toBe('approval_card');
    expect(props(ui)).toMatchObject({ title: 'Adjust budget', currentValue: '€100', proposedValue: '€150', costImpact: { current: 100, proposed: 150, currency: 'EUR' } });
  });

  it('leaves everything else as the Hub sent it', () => {
    const plain = ask('tb', {}, { component: 'approval_card', version: '1', props: { title: 'No cost' } });
    expect(approvalUI(plain, goals)).toBe(plain.ui);
    const noCurrent = ask('other-thread', { costEffect: { proposed: 150 } });
    expect(approvalUI(noCurrent, goals)).toBeUndefined();
    const other = ask('tb', { costEffect: { current: 1, proposed: 2 } }, { component: 'confirm', version: '1', props: {} });
    expect(approvalUI(other, goals)).toBe(other.ui);
    const plan = ask('tb', { askType: 'plan_approval', costEffect: { current: 1, proposed: 2 } });
    expect(approvalUI(plan, goals)).toBeUndefined();
  });
});

describe('control status events in the activity feed', () => {
  it('describes them in plain words instead of "Execution pause"', () => {
    const entry = describeEvent(ev({ type: 'status', payload: { state: 'kill', executionState: 'stopped', message: 'Execution kill' } }));
    expect(entry).toMatchObject({ title: 'Emergency stop engaged', tone: 'danger', category: 'update' });
    expect(describeEvent(ev({ type: 'status', payload: { state: 'executing', message: 'Working' } }))?.title).toBe('Working');
  });
});
