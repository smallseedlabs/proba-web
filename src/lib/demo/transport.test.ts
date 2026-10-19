import { describe, it, expect } from 'vitest';
import type { IncomingEvent, OutgoingCommand } from '../transport';
import { DemoAuthClient } from './auth';
import { ASKS } from './seed';
import { DemoTransport } from './transport';

const command = (type: OutgoingCommand['type'], payload: Record<string, unknown>, threadId?: string): OutgoingCommand => ({
  kind: 'command',
  clientMsgId: 'c-1',
  type,
  payload,
  threadId,
  sentAt: new Date().toISOString(),
});

function connect(workspaceId: string) {
  const transport = new DemoTransport({ workspaceId, latency: 0 });
  const events: IncomingEvent[] = [];
  const statuses: string[] = [];
  transport.subscribe((e) => events.push(e));
  transport.onStatusChange((s) => statuses.push(s));
  transport.connect();
  return { transport, events, statuses };
}

describe('DemoTransport', () => {
  it('replays a populated workspace and reports the connection as open', () => {
    const { events, statuses, transport } = connect('northwind');
    expect(statuses).toEqual(['connecting', 'open']);
    expect(transport.status).toBe('open');
    expect(events.filter((e) => e.type === 'goal_updated')).toHaveLength(3);
    expect(new Set(events.map((e) => e.seq)).size).toBe(events.length);
    const components = new Set(events.map((e) => e.ui?.component).filter(Boolean));
    for (const c of ['metric_chart', 'table', 'spend_bar', 'question_choice', 'approval_card']) expect(components).toContain(c);
  });

  it('starts other workspaces empty', () => {
    const { events, transport } = connect('harbor');
    expect(events).toHaveLength(0);
    expect(transport.status).toBe('open');
  });

  it('answers the audience question with a plan for approval, then proceeds on approval', async () => {
    const { events, transport } = connect('northwind');
    const before = events.length;
    await transport.sendCommand(command('answer_ask', { askId: ASKS.audience, choice: 'approve', values: { answer: 'active' } }));
    const added = events.slice(before);
    expect(added.map((e) => e.type)).toEqual(['ack', 'ask_resolved', 'message', 'ask']);
    expect(added[3].ui?.component).toBe('plan_card');

    const mark = events.length;
    await transport.sendCommand(command('approve_plan', { planId: ASKS.launchPlan, approved: true }));
    expect(events.slice(mark).map((e) => e.type)).toEqual(['ack', 'ask_resolved', 'status', 'goal_updated', 'message']);
  });

  it('acknowledges messages and replies', async () => {
    const { events, transport } = connect('harbor');
    await transport.sendCommand(command('send_message', { text: 'Hello' }, 't1'));
    expect(events.map((e) => e.type)).toEqual(['ack', 'message']);
    expect(events[0].payload).toMatchObject({ clientMsgId: 'c-1' });
  });
});

describe('DemoAuthClient', () => {
  it('signs in with a valid password and rejects short ones', async () => {
    const auth = new DemoAuthClient(0);
    const session = await auth.signIn({ email: 'alex.morgan@northwindoutdoor.com', password: 'long-enough' });
    expect(session.user.name).toBe('Alex Morgan');
    expect(session.workspaces.length).toBeGreaterThan(1);
    await expect(auth.signIn({ email: 'a@b.co', password: 'short' })).rejects.toMatchObject({ code: 'invalid_credentials' });
  });
});
