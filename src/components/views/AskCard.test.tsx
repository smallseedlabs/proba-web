import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { IncomingEvent, TransportClient } from '../../lib/transport';
import { WorkspaceProvider } from '../../state/workspace';
import { ToastProvider } from '../ui/toast';
import { AskCard } from './AskCard';

const placeholder = JSON.stringify({ dailyBudget: 120 }, null, 2);

/** What proba-hub sends for a brain budget proposal: costEffect on the ask, the tool parameters as the card's values. */
const goal: IncomingEvent = {
  kind: 'event', seq: 1, at: '2026-10-26T10:00:00Z', type: 'goal_updated', threadId: 't1',
  payload: { goalId: 'g1', status: 'active' },
  ui: { component: 'goal_summary', version: '1', props: { title: 'Boot', metrics: { spend: 0, budget: 100, currency: 'USD' } } },
};
const ask: IncomingEvent = {
  kind: 'event', seq: 2, at: '2026-10-26T10:01:00Z', type: 'ask', threadId: 't1',
  payload: {
    askId: 'a1', askType: 'action_approval', title: 'Approve tool call: adjust_budget', blocking: true, risk: 'medium', questions: [],
    costEffect: { current: 100, proposed: 120, currency: 'USD', impact: '20.0%' },
  },
  ui: {
    component: 'approval_card', version: '1.0.0',
    props: { title: 'Tool: adjust_budget', action: 'Execute tool call', currentValue: placeholder, proposedValue: placeholder, risk: 'medium', costImpact: { current: 100, proposed: 120, currency: 'USD' } },
  },
};

function renderAsk(events: IncomingEvent[]) {
  const transport: TransportClient = {
    status: 'open', connect: vi.fn(), disconnect: vi.fn(), sendCommand: vi.fn(),
    subscribe: (l) => {
      events.forEach((e) => l(e));
      return () => {};
    },
    onStatusChange: () => () => {},
  };
  render(
    <ToastProvider>
      <WorkspaceProvider transport={transport} onSessionExpired={vi.fn()}>
        <AskCard event={ask} />
      </WorkspaceProvider>
    </ToastProvider>
  );
}

describe('AskCard budget decisions', () => {
  it("shows the ask's real current and proposed amounts instead of repeated parameters", () => {
    renderAsk([goal, ask]);
    const card = screen.getByRole('region', { name: /Approval required/ });
    const current = within(card).getByText('Current').nextElementSibling;
    const proposed = within(card).getByText('Proposed').nextElementSibling;
    expect(current).toHaveTextContent('$100');
    expect(proposed).toHaveTextContent('$120');
    expect(within(card).getByText('Change').nextElementSibling).toHaveTextContent('+$20');
    expect(card).not.toHaveTextContent('dailyBudget');
  });
});
