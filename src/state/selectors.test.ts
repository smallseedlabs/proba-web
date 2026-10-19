import { describe, it, expect } from 'vitest';
import type { IncomingEvent } from '../lib/transport';
import { describeEvent, selectActivity, selectGoals, selectOpenAsks, selectReports, selectThreadItems } from './selectors';
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
